from fastapi import FastAPI, APIRouter, HTTPException, Header, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT & Password
JWT_SECRET = os.environ.get('JWT_SECRET', 'eduntra-secret-key-2025')
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OpenAI Setup
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)

# ========== MODELS ==========

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: str  # 'student' or 'teacher'
    password_hash: str
    interests: Optional[List[str]] = []
    skills: Optional[List[str]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: str
    name: str
    password: str
    role: str

class UserLogin(BaseModel):
    email: str
    password: str

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LearningPath(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject: str
    lessons: List[Dict[str, Any]]
    progress: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CareerProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    interests: List[str]
    skills: List[str]
    recommended_careers: List[Dict[str, Any]]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    company: str
    location: str
    type: str  # 'job' or 'internship'
    required_skills: List[str]
    salary: str
    description: str
    experience_level: str

class LiveClass(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    teacher_id: str
    title: str
    description: str
    scheduled_time: datetime
    duration_minutes: int
    students: List[str] = []
    status: str = 'scheduled'  # scheduled, live, completed
    recording_url: Optional[str] = None

class Quiz(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    questions: List[Dict[str, Any]]
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ========== HELPER FUNCTIONS ==========

def create_jwt_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except:
        raise HTTPException(status_code=401, detail='Invalid token')

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='No authorization token')
    token = authorization.split(' ')[1]
    return verify_token(token)

# ========== AUTH ROUTES ==========

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        password_hash=pwd_context.hash(user_data.password)
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    token = create_jwt_token(user.id, user.email, user.role)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email})
    if not user_doc or not pwd_context.verify(credentials.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user_doc['id'], user_doc['email'], user_doc['role'])
    return {"token": token, "user": {"id": user_doc['id'], "email": user_doc['email'], "name": user_doc['name'], "role": user_doc['role']}}

@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    user_doc = await db.users.find_one({"id": user_data['user_id']}, {"_id": 0, "password_hash": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return user_doc

# ========== AI TUTOR ROUTES ==========

@api_router.post("/tutor/chat")
async def tutor_chat(data: dict, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    
    message = data.get('message')
    session_id = data.get('session_id', 'default')
    detected_language = data.get('language', 'auto')
    
    # Get chat history for context
    history = await db.chat_messages.find(
        {"user_id": user_data['user_id'], "session_id": session_id}
    ).sort("timestamp", -1).limit(10).to_list(10)
    history.reverse()
    
    # Build conversation context
    conversation_context = ""
    if history:
        for msg in history[-5:]:  # Last 5 messages for context
            role = "Student" if msg['role'] == 'user' else "Tutor"
            conversation_context += f"{role}: {msg['content']}\n"
    
    # Save user message
    user_msg = ChatMessage(
        user_id=user_data['user_id'],
        session_id=session_id,
        role='user',
        content=message
    )
    user_msg_doc = user_msg.model_dump()
    user_msg_doc['timestamp'] = user_msg_doc['timestamp'].isoformat()
    await db.chat_messages.insert_one(user_msg_doc)
    
    # Enhanced system prompt for accuracy and language detection
    system_prompt = """You are an expert AI tutor at Eduntra AI platform. Your role is to help students learn effectively and master concepts.

CORE PRINCIPLES:
1. **Language Matching**: ALWAYS respond in the EXACT SAME LANGUAGE the student uses. If they write in Hindi, respond in Hindi. If in Spanish, respond in Spanish. Detect and match their language automatically.

2. **Accuracy**: Provide factually correct, up-to-date information. If unsure, acknowledge it and guide students to verified resources.

3. **Clear Explanations**: 
   - Break down complex topics into simple, digestible parts
   - Use analogies and real-world examples
   - Provide step-by-step explanations for problems

4. **Educational Approach**:
   - Ask guiding questions to encourage critical thinking
   - Don't just give answers - help students understand WHY
   - Adapt difficulty based on student's level
   - Celebrate progress and encourage learning

5. **Engagement**:
   - Be friendly, patient, and encouraging
   - Use appropriate examples for the student's age/level
   - Make learning interactive and interesting

6. **Subject Expertise**: You are knowledgeable in:
   - Mathematics (all levels)
   - Science (Physics, Chemistry, Biology)
   - Programming & Computer Science
   - Languages & Literature
   - History & Social Studies
   - Business & Economics
   - And all other academic subjects

Remember: Match the student's language, be accurate, and make learning enjoyable!"""
    
    # Create enhanced prompt with context
    if conversation_context:
        enhanced_message = f"""Previous conversation context:
{conversation_context}

Current question: {message}

Important: Respond in the SAME LANGUAGE as the current question. Provide accurate, educational responses that build on our conversation."""
    else:
        enhanced_message = f"""Student's question: {message}

Important: Respond in the SAME LANGUAGE as this question. Provide accurate, clear educational explanations."""
    
    # Call GPT-4o with enhanced context
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_prompt
    ).with_model("openai", "gpt-4o")
    
    user_message = UserMessage(text=enhanced_message)
    response = await chat.send_message(user_message)
    
    # Save assistant message
    assistant_msg = ChatMessage(
        user_id=user_data['user_id'],
        session_id=session_id,
        role='assistant',
        content=response
    )
    assistant_msg_doc = assistant_msg.model_dump()
    assistant_msg_doc['timestamp'] = assistant_msg_doc['timestamp'].isoformat()
    await db.chat_messages.insert_one(assistant_msg_doc)
    
    return {"response": response, "session_id": session_id}

@api_router.get("/tutor/history/{session_id}")
async def get_chat_history(session_id: str, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    messages = await db.chat_messages.find(
        {"user_id": user_data['user_id'], "session_id": session_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(100)
    return {"messages": messages}

# ========== LEARNING PATH ROUTES ==========

@api_router.post("/learning/create-path")
async def create_learning_path(data: dict, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    subject = data.get('subject')
    skill_level = data.get('skill_level', 'beginner')
    final_goal = data.get('final_goal', 'Master the fundamentals')
    daily_time = data.get('daily_time', '1 hour')
    timeline = data.get('timeline', '4 weeks')
    roadmap_type = data.get('roadmap_type', 'detailed')
    
    # Generate RoadmapGPT-style comprehensive roadmap
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"roadmap_{user_data['user_id']}",
        system_message="""You are RoadmapGPT, an elite expert in designing structured, professional, customized roadmaps for ANY topic.
You think clearly, organize information perfectly, and produce actionable, step-by-step learning paths.

Your outputs must be:
- Clear and structured
- Beginner-friendly yet comprehensive
- Detailed with time estimates
- Highly practical with real projects
- Motivating and achievable

You MUST respond as a world-class expert teacher."""
    ).with_model("openai", "gpt-4o")
    
    detail_level = "deeply detailed with advanced concepts, multiple projects, and expert-level resources" if roadmap_type == 'advanced' else "well-structured with essential concepts and practical projects"
    
    prompt = f"""Create a COMPREHENSIVE {detail_level} roadmap for: {subject}

USER PROFILE:
- Current Level: {skill_level}
- Final Goal: {final_goal}
- Daily Study Time: {daily_time}
- Timeline: {timeline}

Create a professional roadmap with phases. For EACH phase include:

1. Phase name and duration
2. Clear learning objectives
3. Topics to master (3-5 topics)
4. Detailed description of what they'll learn
5. Practical exercises/mini-projects
6. Recommended tools, resources, websites, or books
7. Common mistakes to avoid
8. Success metrics (how to know you've mastered this phase)

Return ONLY valid JSON (no markdown):
{{
  "overview": {{
    "total_duration": "{timeline}",
    "total_phases": 4,
    "estimated_hours": 60,
    "difficulty": "{skill_level}"
  }},
  "lessons": [
    {{
      "phase": 1,
      "title": "Foundation & Basics",
      "duration": "Week 1",
      "objectives": ["Master fundamental concepts", "Build first project"],
      "topics": ["Core concept 1", "Core concept 2", "Core concept 3"],
      "description": "Detailed description of what you'll learn",
      "practice": "Build a beginner project",
      "resources": ["Resource 1", "Resource 2"],
      "tools": ["Tool 1", "Tool 2"],
      "common_mistakes": ["Mistake 1", "Mistake 2"],
      "success_metrics": ["Can do X", "Understand Y"],
      "duration_minutes": 300
    }}
  ],
  "final_checklist": [
    "Skill checkpoint 1",
    "Skill checkpoint 2",
    "Can build X from scratch"
  ],
  "next_steps": [
    "Advanced topic 1",
    "Advanced topic 2"
  ]
}}

Make it {detail_level} and perfectly suited for {skill_level} level."""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    try:
        import json
        # Clean response
        clean_response = response.strip()
        if clean_response.startswith('```'):
            clean_response = clean_response.split('```')[1]
            if clean_response.startswith('json'):
                clean_response = clean_response[4:]
        clean_response = clean_response.strip()
        
        roadmap_data = json.loads(clean_response)
        lessons = roadmap_data.get('lessons', [])
        overview = roadmap_data.get('overview', {})
        final_checklist = roadmap_data.get('final_checklist', [])
        next_steps = roadmap_data.get('next_steps', [])
        
        if not lessons or len(lessons) == 0:
            raise ValueError("No lessons returned")
            
    except Exception as e:
        logger.error(f"Failed to parse roadmap: {e}")
        lessons, overview, final_checklist, next_steps = generate_fallback_roadmap(subject, skill_level, timeline)
    
    learning_path = LearningPath(
        user_id=user_data['user_id'],
        subject=subject,
        lessons=lessons
    )
    
    # Add metadata
    doc = learning_path.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['overview'] = overview
    doc['final_checklist'] = final_checklist
    doc['next_steps'] = next_steps
    doc['skill_level'] = skill_level
    doc['final_goal'] = final_goal
    doc['daily_time'] = daily_time
    doc['timeline'] = timeline
    
    await db.learning_paths.insert_one(doc)
    
    return doc

def generate_fallback_roadmap(subject, skill_level, timeline):
    """Generate comprehensive fallback roadmap"""
    overview = {
        "total_duration": timeline,
        "total_phases": 4,
        "estimated_hours": 60,
        "difficulty": skill_level
    }
    
    lessons = [
        {
            "phase": 1,
            "title": f"Foundation & Fundamentals of {subject}",
            "duration": "Week 1",
            "objectives": [f"Understand core {subject} concepts", "Set up learning environment", "Complete first exercises"],
            "topics": ["Basic terminology", "Core principles", "Getting started", "First hands-on practice"],
            "description": f"Build a rock-solid foundation in {subject}. You'll learn the essential concepts, understand why they matter, and get hands-on practice with beginner-friendly exercises.",
            "practice": f"Complete 5 beginner exercises in {subject}. Build your first mini-project to apply what you've learned.",
            "resources": ["Official documentation", "Video tutorial series", "Interactive coding platform"],
            "tools": ["VS Code or preferred editor", "Online playground", "Community forum"],
            "common_mistakes": ["Rushing through basics", "Not practicing enough", "Skipping documentation"],
            "success_metrics": ["Can explain core concepts", "Completed all basic exercises", "Built first project"],
            "duration_minutes": 420
        },
        {
            "phase": 2,
            "title": f"Intermediate {subject} Skills",
            "duration": "Week 2",
            "objectives": [f"Master intermediate {subject} concepts", "Build practical projects", "Understand best practices"],
            "topics": ["Advanced concepts", "Design patterns", "Problem-solving techniques", "Real-world applications"],
            "description": f"Level up your {subject} skills with intermediate concepts. Learn industry best practices and build projects that showcase your growing expertise.",
            "practice": f"Build 2-3 intermediate projects. Solve 15 coding challenges. Refactor your previous work.",
            "resources": ["Advanced course", "Project-based tutorials", "GitHub repositories for reference"],
            "tools": ["Testing frameworks", "Debugging tools", "Version control (Git)"],
            "common_mistakes": ["Not following best practices", "Ignoring code quality", "Working in isolation"],
            "success_metrics": ["Can solve intermediate problems", "Portfolio has 3 solid projects", "Understand design patterns"],
            "duration_minutes": 540
        },
        {
            "phase": 3,
            "title": f"Advanced {subject} & Specialization",
            "duration": "Week 3",
            "objectives": [f"Master advanced {subject} topics", "Choose specialization area", "Build complex projects"],
            "topics": ["Performance optimization", "Advanced patterns", "System design", "Specialized topics"],
            "description": f"Dive deep into advanced {subject} topics. Choose your specialization area and become an expert in specific domains.",
            "practice": f"Build 1 complex, production-ready project. Contribute to open-source. Optimize existing code for performance.",
            "resources": ["Advanced books", "Research papers", "Expert blogs and talks"],
            "tools": ["Profiling tools", "Advanced frameworks", "Cloud platforms"],
            "common_mistakes": ["Trying to learn everything", "Not specializing", "Avoiding complex problems"],
            "success_metrics": ["Can architect complex systems", "Expert in chosen specialization", "Production-ready project"],
            "duration_minutes": 600
        },
        {
            "phase": 4,
            "title": f"Mastery & Real-World Application",
            "duration": "Week 4",
            "objectives": ["Apply skills in real-world scenarios", "Build capstone project", "Prepare for opportunities"],
            "topics": ["Industry practices", "Interview preparation", "Portfolio building", "Continuous learning"],
            "description": f"Transform your {subject} knowledge into marketable skills. Build an impressive capstone project and prepare for real opportunities.",
            "practice": f"Build capstone project. Prepare resume and portfolio. Practice technical interviews. Network with professionals.",
            "resources": ["Interview prep platforms", "Portfolio examples", "Networking communities"],
            "tools": ["Portfolio website builder", "Interview prep tools", "LinkedIn"],
            "common_mistakes": ["Poor portfolio presentation", "Not networking", "Stopping learning"],
            "success_metrics": [f"Expert-level {subject} skills", "Impressive portfolio", "Ready for opportunities"],
            "duration_minutes": 480
        }
    ]
    
    final_checklist = [
        f"✅ Deep understanding of {subject} fundamentals",
        "✅ Built 5+ projects showcasing various skills",
        "✅ Can solve complex problems independently",
        "✅ Portfolio ready to showcase to employers",
        f"✅ Active in {subject} community",
        "✅ Ready for technical interviews",
        "✅ Continuous learning habit established"
    ]
    
    next_steps = [
        f"Explore advanced {subject} specializations",
        "Contribute to major open-source projects",
        "Start freelancing or apply for jobs",
        "Mentor others learning {subject}",
        "Stay updated with latest trends"
    ]
    
    return lessons, overview, final_checklist, next_steps

def generate_fallback_lessons(subject, skill_level):
    """Generate fallback lessons if AI fails"""
    base_lessons = [
        {
            "title": f"Introduction to {subject}",
            "description": f"Learn the fundamentals and core concepts of {subject}. Understand why {subject} is important and what you can achieve with it.",
            "duration_minutes": 45,
            "week": "Week 1",
            "topics": ["Basic concepts", "Key terminology", "Overview of applications"],
            "resources": ["Official documentation", "Beginner tutorial videos"],
            "practice": "Complete introductory exercises"
        },
        {
            "title": f"Core Principles of {subject}",
            "description": f"Deep dive into the fundamental principles that power {subject}. Build a strong foundation for advanced topics.",
            "duration_minutes": 60,
            "week": "Week 1",
            "topics": ["Core concepts", "Essential principles", "Best practices"],
            "resources": ["Interactive tutorials", "Practice problems"],
            "practice": "Solve 10 basic problems"
        },
        {
            "title": f"Practical Applications",
            "description": f"Apply your {subject} knowledge to real-world scenarios. Learn through hands-on projects and examples.",
            "duration_minutes": 75,
            "week": "Week 2",
            "topics": ["Real-world use cases", "Common patterns", "Practical examples"],
            "resources": ["Project templates", "Code examples"],
            "practice": "Build your first mini-project"
        },
        {
            "title": f"Intermediate Techniques",
            "description": f"Level up your {subject} skills with intermediate concepts and techniques used by professionals.",
            "duration_minutes": 60,
            "week": "Week 2",
            "topics": ["Advanced concepts", "Optimization", "Common patterns"],
            "resources": ["Advanced tutorials", "Documentation"],
            "practice": "Complete intermediate challenges"
        },
        {
            "title": f"Tools and Ecosystem",
            "description": f"Explore the tools, libraries, and frameworks that make working with {subject} easier and more efficient.",
            "duration_minutes": 50,
            "week": "Week 3",
            "topics": ["Popular tools", "Libraries", "Development environment"],
            "resources": ["Tool documentation", "Setup guides"],
            "practice": "Set up professional workflow"
        },
        {
            "title": f"Building Real Projects",
            "description": f"Put everything together by building complete, real-world projects using {subject}.",
            "duration_minutes": 90,
            "week": "Week 3",
            "topics": ["Project planning", "Implementation", "Testing"],
            "resources": ["Project ideas", "Code repositories"],
            "practice": "Build a portfolio project"
        },
        {
            "title": f"Best Practices & Patterns",
            "description": f"Learn industry best practices, design patterns, and professional standards for {subject}.",
            "duration_minutes": 60,
            "week": "Week 4",
            "topics": ["Code quality", "Design patterns", "Industry standards"],
            "resources": ["Style guides", "Best practice docs"],
            "practice": "Refactor previous projects"
        },
        {
            "title": f"Advanced Topics & Mastery",
            "description": f"Master advanced {subject} techniques and prepare for professional-level work.",
            "duration_minutes": 75,
            "week": "Week 4",
            "topics": ["Advanced techniques", "Performance", "Scalability"],
            "resources": ["Advanced courses", "Research papers"],
            "practice": "Complete capstone project"
        }
    ]
    
    return base_lessons

@api_router.get("/learning/my-paths")
async def get_my_paths(authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    paths = await db.learning_paths.find({"user_id": user_data['user_id']}, {"_id": 0}).to_list(100)
    return {"paths": paths}

@api_router.put("/learning/progress/{path_id}")
async def update_progress(path_id: str, data: dict, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    progress = data.get('progress', 0)
    completed_phases = data.get('completed_phases', [])
    
    await db.learning_paths.update_one(
        {"id": path_id, "user_id": user_data['user_id']},
        {
            "$set": {
                "progress": progress,
                "completed_phases": completed_phases,
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"success": True}

@api_router.get("/learning/analytics/{path_id}")
async def get_path_analytics(path_id: str, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    
    path = await db.learning_paths.find_one(
        {"id": path_id, "user_id": user_data['user_id']},
        {"_id": 0}
    )
    
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    
    # Calculate analytics
    total_lessons = len(path.get('lessons', []))
    completed_phases = path.get('completed_phases', [])
    progress = path.get('progress', 0)
    
    # Time analytics
    total_minutes = sum(lesson.get('duration_minutes', 0) for lesson in path.get('lessons', []))
    completed_minutes = int((progress / 100) * total_minutes)
    remaining_minutes = total_minutes - completed_minutes
    
    # Phase completion
    phase_stats = []
    for lesson in path.get('lessons', []):
        phase = lesson.get('phase', 1)
        phase_stats.append({
            "phase": phase,
            "title": lesson.get('title', ''),
            "completed": phase in completed_phases,
            "duration_minutes": lesson.get('duration_minutes', 0)
        })
    
    # Learning streak (mock for now)
    from datetime import timedelta
    created_date = datetime.fromisoformat(path.get('created_at', datetime.now(timezone.utc).isoformat()))
    days_since_start = (datetime.now(timezone.utc) - created_date).days
    
    analytics = {
        "overview": path.get('overview', {}),
        "progress": {
            "percentage": progress,
            "completed_phases": len(completed_phases),
            "total_phases": total_lessons,
            "completed_lessons": len(completed_phases),
            "total_lessons": total_lessons
        },
        "time": {
            "total_hours": round(total_minutes / 60, 1),
            "completed_hours": round(completed_minutes / 60, 1),
            "remaining_hours": round(remaining_minutes / 60, 1),
            "estimated_completion": path.get('timeline', '4 weeks')
        },
        "phases": phase_stats,
        "streak": {
            "current_streak": min(days_since_start, 7),
            "total_study_days": days_since_start,
            "consistency_score": min(100, int((days_since_start / 30) * 100))
        },
        "milestones": {
            "started": True,
            "25_percent": progress >= 25,
            "50_percent": progress >= 50,
            "75_percent": progress >= 75,
            "completed": progress >= 100
        }
    }
    
    return analytics

# ========== CAREER & JOB ROUTES ==========

@api_router.post("/career/analyze")
async def analyze_career(data: dict, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    interests = data.get('interests', [])
    skills = data.get('skills', [])
    
    # AI-powered career analysis
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"career_{user_data['user_id']}",
        system_message="You are a professional career counselor. Provide detailed, realistic career recommendations."
    ).with_model("openai", "gpt-4o")
    
    prompt = f"""Based on these interests: {', '.join(interests)} and skills: {', '.join(skills)}, recommend 5 suitable career paths.

For each career, provide:
- title: Career title
- description: Brief description (2-3 sentences)
- salary_range: Expected salary (e.g., "$50k-$80k per year" or "₹6-12 LPA")
- required_skills: List of 4-6 key skills needed
- roadmap: List of 5-7 specific steps to reach this career

Return ONLY valid JSON in this exact format, no markdown:
{{"careers": [{{"title": "Software Developer", "description": "Build applications and software", "salary_range": "$60k-$100k", "required_skills": ["Python", "JavaScript", "Problem Solving"], "roadmap": ["Learn programming basics", "Build portfolio projects", "Get internship"]}}]}}"""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    try:
        import json
        # Clean response - remove markdown code blocks if present
        clean_response = response.strip()
        if clean_response.startswith('```'):
            clean_response = clean_response.split('```')[1]
            if clean_response.startswith('json'):
                clean_response = clean_response[4:]
        clean_response = clean_response.strip()
        
        career_data = json.loads(clean_response)
        careers = career_data.get('careers', [])
        
        # Ensure we have valid data
        if not careers or len(careers) == 0:
            raise ValueError("No careers returned")
            
    except Exception as e:
        logger.error(f"Failed to parse AI response: {e}, Response: {response}")
        # Fallback to predefined careers based on interests/skills
        careers = generate_fallback_careers(interests, skills)
    
    profile = CareerProfile(
        user_id=user_data['user_id'],
        interests=interests,
        skills=skills,
        recommended_careers=careers
    )
    
    doc = profile.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.career_profiles.insert_one(doc)
    
    return {"careers": careers}

def generate_fallback_careers(interests, skills):
    """Generate fallback career suggestions if AI fails"""
    fallback_careers = []
    
    # Tech-related
    if any(s.lower() in ['programming', 'coding', 'python', 'javascript', 'tech', 'computer'] for s in skills + interests):
        fallback_careers.append({
            "title": "Software Developer",
            "description": "Design, develop, and maintain software applications. Work with various programming languages and frameworks to create solutions.",
            "salary_range": "₹6-15 LPA",
            "required_skills": ["Programming", "Problem Solving", "Algorithms", "Data Structures", "Git"],
            "roadmap": ["Master a programming language (Python/JavaScript)", "Learn data structures and algorithms", "Build 5-10 portfolio projects", "Contribute to open source", "Apply for internships", "Prepare for technical interviews", "Land first developer role"]
        })
    
    # Design-related
    if any(s.lower() in ['design', 'creative', 'art', 'ui', 'ux'] for s in skills + interests):
        fallback_careers.append({
            "title": "UI/UX Designer",
            "description": "Create user-friendly interfaces and experiences for digital products. Focus on user research, wireframing, and visual design.",
            "salary_range": "₹4-10 LPA",
            "required_skills": ["Figma", "Adobe XD", "User Research", "Wireframing", "Prototyping"],
            "roadmap": ["Learn design fundamentals", "Master Figma/Adobe XD", "Study UX principles", "Build design portfolio", "Complete design challenges", "Network with designers", "Apply for design roles"]
        })
    
    # Business-related
    if any(s.lower() in ['business', 'marketing', 'management', 'strategy'] for s in skills + interests):
        fallback_careers.append({
            "title": "Business Analyst",
            "description": "Analyze business processes and recommend improvements. Work with data to drive business decisions and strategy.",
            "salary_range": "₹5-12 LPA",
            "required_skills": ["Excel", "Data Analysis", "SQL", "Communication", "Problem Solving"],
            "roadmap": ["Learn Excel and SQL", "Understand business fundamentals", "Study data analysis", "Work on case studies", "Get business certifications", "Build analysis portfolio", "Apply for analyst positions"]
        })
    
    # Data-related
    if any(s.lower() in ['data', 'analytics', 'statistics', 'math', 'science'] for s in skills + interests):
        fallback_careers.append({
            "title": "Data Analyst",
            "description": "Collect, process, and analyze data to help organizations make informed decisions. Create visualizations and reports.",
            "salary_range": "₹5-10 LPA",
            "required_skills": ["Python", "SQL", "Excel", "Statistics", "Data Visualization"],
            "roadmap": ["Learn Python and SQL", "Study statistics", "Master Excel", "Learn Tableau/Power BI", "Work on data projects", "Build analysis portfolio", "Apply for data roles"]
        })
    
    # Content/Writing
    if any(s.lower() in ['writing', 'content', 'communication', 'english'] for s in skills + interests):
        fallback_careers.append({
            "title": "Content Writer",
            "description": "Create engaging written content for websites, blogs, social media, and marketing materials. Research topics and write clear, compelling copy.",
            "salary_range": "₹3-7 LPA",
            "required_skills": ["Writing", "SEO", "Research", "Editing", "Creativity"],
            "roadmap": ["Improve writing skills", "Learn SEO basics", "Start a blog", "Build writing portfolio", "Join content platforms", "Network with writers", "Apply for writing positions"]
        })
    
    # Ensure we have at least 3 careers
    if len(fallback_careers) < 3:
        fallback_careers.extend([
            {
                "title": "Digital Marketing Specialist",
                "description": "Plan and execute digital marketing campaigns across various channels. Analyze metrics and optimize for better results.",
                "salary_range": "₹4-9 LPA",
                "required_skills": ["Social Media", "SEO", "Google Ads", "Analytics", "Content Marketing"],
                "roadmap": ["Learn digital marketing basics", "Get Google certifications", "Practice with real campaigns", "Build case studies", "Master social media", "Network in marketing", "Apply for marketing roles"]
            },
            {
                "title": "Project Coordinator",
                "description": "Support project managers in planning, executing, and closing projects. Coordinate team activities and track project progress.",
                "salary_range": "₹4-8 LPA",
                "required_skills": ["Organization", "Communication", "MS Office", "Time Management", "Teamwork"],
                "roadmap": ["Learn project management basics", "Get PMP/Agile certification", "Develop organizational skills", "Volunteer for projects", "Build coordination experience", "Network with PMs", "Apply for coordinator roles"]
            }
        ])
    
    return fallback_careers[:5]

@api_router.get("/jobs")
async def get_jobs(job_type: str = 'job', authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    
    # Check if jobs exist, if not seed them
    count = await db.jobs.count_documents({})
    if count == 0:
        await seed_jobs()
    
    jobs = await db.jobs.find({"type": job_type}, {"_id": 0}).to_list(100)
    return {"jobs": jobs}

@api_router.post("/jobs/recommend")
async def recommend_jobs(authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    user_doc = await db.users.find_one({"id": user_data['user_id']})
    
    skills = user_doc.get('skills', [])
    
    # Get all jobs and match with skills
    all_jobs = await db.jobs.find({}, {"_id": 0}).to_list(100)
    
    # Simple matching algorithm
    matched_jobs = []
    for job in all_jobs:
        match_score = len(set(skills) & set(job.get('required_skills', [])))
        if match_score > 0:
            job['match_score'] = match_score
            matched_jobs.append(job)
    
    matched_jobs.sort(key=lambda x: x.get('match_score', 0), reverse=True)
    
    return {"jobs": matched_jobs[:20]}

# ========== LIVE CLASSES ROUTES ==========

@api_router.post("/classes/create")
async def create_class(data: dict, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    
    if user_data['role'] != 'teacher':
        raise HTTPException(status_code=403, detail="Only teachers can create classes")
    
    live_class = LiveClass(
        teacher_id=user_data['user_id'],
        title=data.get('title'),
        description=data.get('description'),
        scheduled_time=datetime.fromisoformat(data.get('scheduled_time')),
        duration_minutes=data.get('duration_minutes', 60)
    )
    
    doc = live_class.model_dump()
    doc['scheduled_time'] = doc['scheduled_time'].isoformat()
    await db.live_classes.insert_one(doc)
    
    return live_class.model_dump()

@api_router.get("/classes/schedule")
async def get_schedule(authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    classes = await db.live_classes.find({}, {"_id": 0}).sort("scheduled_time", 1).to_list(100)
    return {"classes": classes}

@api_router.post("/classes/{class_id}/join")
async def join_class(class_id: str, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    
    await db.live_classes.update_one(
        {"id": class_id},
        {"$addToSet": {"students": user_data['user_id']}}
    )
    
    return {"success": True, "class_id": class_id}

# ========== TEACHER DASHBOARD ==========

@api_router.get("/teacher/students")
async def get_students(authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    
    if user_data['role'] != 'teacher':
        raise HTTPException(status_code=403, detail="Only teachers can access this")
    
    students = await db.users.find({"role": "student"}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"students": students}

@api_router.get("/teacher/analytics/{student_id}")
async def get_student_analytics(student_id: str, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    
    if user_data['role'] != 'teacher':
        raise HTTPException(status_code=403, detail="Only teachers can access this")
    
    # Get learning paths
    paths = await db.learning_paths.find({"user_id": student_id}, {"_id": 0}).to_list(100)
    
    # Calculate analytics
    total_lessons = sum(len(p.get('lessons', [])) for p in paths)
    avg_progress = sum(p.get('progress', 0) for p in paths) / len(paths) if paths else 0
    
    return {
        "student_id": student_id,
        "learning_paths": len(paths),
        "total_lessons": total_lessons,
        "average_progress": avg_progress,
        "paths": paths
    }

# ========== SYNC ROUTES ==========

@api_router.post("/sync/upload")
async def sync_upload(data: dict, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    
    # Process offline data
    sync_data = data.get('data', [])
    
    for item in sync_data:
        item_type = item.get('type')
        item_data = item.get('data')
        
        if item_type == 'progress':
            await db.learning_paths.update_one(
                {"id": item_data.get('path_id'), "user_id": user_data['user_id']},
                {"$set": {"progress": item_data.get('progress')}}
            )
    
    return {"success": True, "synced": len(sync_data)}

# ========== SEED DATA ==========

async def seed_jobs():
    mock_jobs = [
        {"id": str(uuid.uuid4()), "title": "Frontend Developer", "company": "TechCorp", "location": "Bangalore", "type": "job", "required_skills": ["React", "JavaScript", "CSS"], "salary": "₹6-10 LPA", "description": "Build modern web applications", "experience_level": "Entry"},
        {"id": str(uuid.uuid4()), "title": "Data Analyst", "company": "DataHub", "location": "Mumbai", "type": "job", "required_skills": ["Python", "SQL", "Excel"], "salary": "₹5-8 LPA", "description": "Analyze business data", "experience_level": "Entry"},
        {"id": str(uuid.uuid4()), "title": "UI/UX Designer", "company": "DesignStudio", "location": "Hyderabad", "type": "job", "required_skills": ["Figma", "Adobe XD", "Design Thinking"], "salary": "₹4-7 LPA", "description": "Create user interfaces", "experience_level": "Entry"},
        {"id": str(uuid.uuid4()), "title": "Python Developer", "company": "CodeWorks", "location": "Pune", "type": "job", "required_skills": ["Python", "Django", "FastAPI"], "salary": "₹7-12 LPA", "description": "Backend development", "experience_level": "Mid"},
        {"id": str(uuid.uuid4()), "title": "Content Writer", "company": "MediaCo", "location": "Remote", "type": "job", "required_skills": ["Writing", "SEO", "Research"], "salary": "₹3-5 LPA", "description": "Create engaging content", "experience_level": "Entry"},
        {"id": str(uuid.uuid4()), "title": "Marketing Intern", "company": "StartupXYZ", "location": "Delhi", "type": "internship", "required_skills": ["Social Media", "Marketing", "Communication"], "salary": "₹10k-15k/month", "description": "Digital marketing internship", "experience_level": "Fresher"},
        {"id": str(uuid.uuid4()), "title": "Software Development Intern", "company": "TechSolutions", "location": "Bangalore", "type": "internship", "required_skills": ["Programming", "Problem Solving"], "salary": "₹15k-20k/month", "description": "Learn software development", "experience_level": "Fresher"},
        {"id": str(uuid.uuid4()), "title": "Graphic Designer", "company": "CreativeHub", "location": "Chennai", "type": "job", "required_skills": ["Photoshop", "Illustrator", "Creativity"], "salary": "₹4-6 LPA", "description": "Design visual content", "experience_level": "Entry"},
        {"id": str(uuid.uuid4()), "title": "Business Analyst", "company": "ConsultCorp", "location": "Gurgaon", "type": "job", "required_skills": ["Analysis", "Excel", "Communication"], "salary": "₹6-9 LPA", "description": "Business process analysis", "experience_level": "Mid"},
        {"id": str(uuid.uuid4()), "title": "AI/ML Intern", "company": "AILabs", "location": "Bangalore", "type": "internship", "required_skills": ["Python", "Machine Learning", "Data Science"], "salary": "₹20k-25k/month", "description": "AI research internship", "experience_level": "Fresher"},
    ]
    
    await db.jobs.insert_many(mock_jobs)

# ========== ROOT ==========

@api_router.get("/")
async def root():
    return {"message": "Eduntra AI API v1.0", "status": "running"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@app.on_event("shutdown") 
async def shutdown_db_client(): 
    client.close() 