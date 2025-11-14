import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      welcome: 'Welcome to Eduntra AI',
      login: 'Login',
      register: 'Register',
      logout: 'Logout',
      student: 'Student',
      teacher: 'Teacher',
      aiTutor: 'AI Tutor',
      learning: 'Learning',
      career: 'Career',
      jobs: 'Jobs & Internships',
      liveClasses: 'Live Classes',
      dashboard: 'Dashboard',
      askQuestion: 'Ask me anything...',
      send: 'Send'
    }
  },
  hi: {
    translation: {
      welcome: 'एडुंट्रा एआई में आपका स्वागत है',
      login: 'लॉगिन',
      register: 'पंजीकरण',
      logout: 'लॉगआउट',
      student: 'छात्र',
      teacher: 'शिक्षक',
      aiTutor: 'एआई ट्यूटर',
      learning: 'सीखना',
      career: 'करियर',
      jobs: 'नौकरियां और इंटर्नशिप',
      liveClasses: 'लाइव कक्षाएं',
      dashboard: 'डैशबोर्ड',
      askQuestion: 'मुझसे कुछ भी पूछें...',
      send: 'भेजें'
    }
  },
  es: {
    translation: {
      welcome: 'Bienvenido a Eduntra AI',
      login: 'Iniciar sesión',
      register: 'Registrarse',
      logout: 'Cerrar sesión',
      student: 'Estudiante',
      teacher: 'Profesor',
      aiTutor: 'Tutor de IA',
      learning: 'Aprendizaje',
      career: 'Carrera',
      jobs: 'Trabajos y Pasantías',
      liveClasses: 'Clases en vivo',
      dashboard: 'Tablero',
      askQuestion: 'Pregúntame cualquier cosa...',
      send: 'Enviar'
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;