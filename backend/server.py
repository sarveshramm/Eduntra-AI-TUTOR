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
    language = data.get('language', 'English')
    
    # Get chat history
    history = await db.chat_messages.find(
        {"user_id": user_data['user_id'], "session_id": session_id}
    ).sort("timestamp", -1).limit(10).to_list(10)
    history.reverse()
    
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
    
    # Call GPT-4o
    system_prompt = f"""You are an expert AI tutor for Eduntra AI platform. You help students learn effectively.
    - Provide clear, educational explanations
    - Use simple language and examples
    - Encourage critical thinking
    - Support students in their learning journey
    - Respond in {language} language"""
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_prompt
    ).with_model("openai", "gpt-4o")
    
    user_message = UserMessage(text=message)
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
    
    # Generate personalized learning path with AI
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"learning_{user_data['user_id']}",
        system_message="You are an education curriculum designer."
    ).with_model("openai", "gpt-4o")
    
    prompt = f"""Create a structured learning path for {subject} at {skill_level} level.
    Return a JSON array of 10 lessons with: title, description, duration_minutes, topics[]
    Format: {{"lessons": [{{"title": "", "description": "", "duration_minutes": 30, "topics": []}}]}}"""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    try:
        import json
        lessons_data = json.loads(response)
        lessons = lessons_data.get('lessons', [])
    except:
        lessons = [
            {"title": f"{subject} Lesson {i+1}", "description": "Interactive lesson", "duration_minutes": 30, "topics": []}
            for i in range(10)
        ]
    
    learning_path = LearningPath(
        user_id=user_data['user_id'],
        subject=subject,
        lessons=lessons
    )
    
    doc = learning_path.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.learning_paths.insert_one(doc)
    
    return learning_path.model_dump()

@api_router.get("/learning/my-paths")
async def get_my_paths(authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    paths = await db.learning_paths.find({"user_id": user_data['user_id']}, {"_id": 0}).to_list(100)
    return {"paths": paths}

@api_router.put("/learning/progress/{path_id}")
async def update_progress(path_id: str, data: dict, authorization: Optional[str] = Header(None)):
    user_data = await get_current_user(authorization)
    progress = data.get('progress', 0)
    
    await db.learning_paths.update_one(
        {"id": path_id, "user_id": user_data['user_id']},
        {"$set": {"progress": progress}}
    )
    
    return {"success": True}

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
        system_message="You are a career counselor and job advisor."
    ).with_model("openai", "gpt-4o")
    
    prompt = f"""Based on interests: {interests} and skills: {skills}, recommend 5 career paths.
    Return JSON: {{"careers": [{{"title": "", "description": "", "salary_range": "", "required_skills": [], "roadmap": []}}]}}"""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    try:
        import json
        career_data = json.loads(response)
        careers = career_data.get('careers', [])
    except:
        careers = []
    
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