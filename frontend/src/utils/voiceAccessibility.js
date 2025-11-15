// Voice Accessibility System for Blind/Visually Impaired Users

export class VoiceAccessibilityManager {
  constructor() {
    this.currentPage = '';
    this.currentSections = [];
    this.isReading = false;
    this.readingQueue = [];
    this.currentItemIndex = 0;
    this.speechSynthesis = window.speechSynthesis;
    this.recognition = null;
    this.onCommandCallback = null;
    this.interruptFlag = false;
  }

  // Initialize voice recognition for commands
  initVoiceCommands(onCommand) {
    this.onCommandCallback = onCommand;
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      
      this.recognition.onresult = (event) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        this.handleVoiceCommand(command);
      };
    }
  }

  // Handle voice commands
  handleVoiceCommand(command) {
    console.log('Voice command received:', command);
    
    // Stop current speech if speaking
    if (command.includes('stop') || command.includes('quiet') || command.includes('pause')) {
      this.stopSpeaking();
      return;
    }

    // Navigation commands
    if (command.includes('open 1') || command.includes('section 1') || command.includes('first section')) {
      this.onCommandCallback?.({ type: 'navigate', section: 0 });
    } else if (command.includes('open 2') || command.includes('section 2') || command.includes('second section')) {
      this.onCommandCallback?.({ type: 'navigate', section: 1 });
    } else if (command.includes('open 3') || command.includes('section 3') || command.includes('third section')) {
      this.onCommandCallback?.({ type: 'navigate', section: 2 });
    } else if (command.includes('open 4') || command.includes('section 4') || command.includes('fourth section')) {
      this.onCommandCallback?.({ type: 'navigate', section: 3 });
    } else if (command.includes('open 5') || command.includes('section 5') || command.includes('fifth section')) {
      this.onCommandCallback?.({ type: 'navigate', section: 4 });
    }
    
    // Page navigation
    else if (command.includes('go to') || command.includes('open')) {
      if (command.includes('tutor') || command.includes('ai tutor')) {
        this.onCommandCallback?.({ type: 'navigate', page: 'tutor' });
      } else if (command.includes('learning') || command.includes('roadmap')) {
        this.onCommandCallback?.({ type: 'navigate', page: 'learning' });
      } else if (command.includes('career')) {
        this.onCommandCallback?.({ type: 'navigate', page: 'career' });
      } else if (command.includes('job') || command.includes('internship')) {
        this.onCommandCallback?.({ type: 'navigate', page: 'jobs' });
      } else if (command.includes('class')) {
        this.onCommandCallback?.({ type: 'navigate', page: 'classes' });
      } else if (command.includes('dashboard') || command.includes('home')) {
        this.onCommandCallback?.({ type: 'navigate', page: 'dashboard' });
      }
    }
    
    // List navigation
    else if (command.includes('next')) {
      this.onCommandCallback?.({ type: 'next' });
    } else if (command.includes('previous') || command.includes('back')) {
      this.onCommandCallback?.({ type: 'previous' });
    } else if (command.includes('repeat') || command.includes('again')) {
      this.onCommandCallback?.({ type: 'repeat' });
    } else if (command.includes('details') || command.includes('more info')) {
      this.onCommandCallback?.({ type: 'details' });
    } else if (command.includes('skip')) {
      this.onCommandCallback?.({ type: 'skip' });
    }
    
    // Speed control
    else if (command.includes('slower') || command.includes('slow down')) {
      this.onCommandCallback?.({ type: 'speed', value: 'slower' });
    } else if (command.includes('faster') || command.includes('speed up')) {
      this.onCommandCallback?.({ type: 'speed', value: 'faster' });
    }
    
    // Confirmation
    else if (command.includes('yes') || command.includes('confirm') || command.includes('ok')) {
      this.onCommandCallback?.({ type: 'confirm', value: true });
    } else if (command.includes('no') || command.includes('cancel')) {
      this.onCommandCallback?.({ type: 'confirm', value: false });
    }
    
    // Help
    else if (command.includes('help') || command.includes('what can i do')) {
      this.announceHelp();
    }
  }

  // Announce page entry
  announcePage(pageName, sections) {
    this.currentPage = pageName;
    this.currentSections = sections;
    
    let announcement = `You are on the ${pageName} page. `;
    
    if (sections.length > 0) {
      announcement += `This page has ${sections.length} sections: `;
      sections.forEach((section, index) => {
        announcement += `${index + 1}, ${section.name}. `;
      });
      announcement += `Say the section number or name to open it, or say 'help' for more options.`;
    }
    
    this.speak(announcement, 'page-announcement');
  }

  // Announce section entry
  announceSection(sectionName, items) {
    let announcement = `You opened ${sectionName}. `;
    
    if (items && items.length > 0) {
      announcement += `This section has ${items.length} items. `;
      announcement += `Say 'read all' to hear all items, or 'next' to go through them one by one.`;
    } else {
      announcement += `This section is currently empty.`;
    }
    
    this.speak(announcement, 'section-announcement');
  }

  // Read list items one by one
  readListItem(item, index, total) {
    let announcement = `Item ${index + 1} of ${total}. `;
    
    if (item.title) announcement += `${item.title}. `;
    if (item.company) announcement += `Company: ${item.company}. `;
    if (item.location) announcement += `Location: ${item.location}. `;
    if (item.description) announcement += `${item.description.substring(0, 100)}. `;
    
    announcement += `Say 'details' for more information, 'next' for the next item, or 'back' for previous.`;
    
    this.speak(announcement, 'list-item');
  }

  // Announce help
  announceHelp() {
    const help = `
      Voice commands you can use:
      Say 'open' followed by a number or section name to navigate.
      Say 'next' or 'previous' to move through items.
      Say 'details' or 'more info' to get full information.
      Say 'repeat' or 'again' to hear the current item again.
      Say 'slower' or 'faster' to adjust reading speed.
      Say 'stop' to stop speaking.
      Say 'help' anytime to hear these options again.
    `;
    
    this.speak(help, 'help');
  }

  // Speak with female voice and interrupt capability
  speak(text, type = 'general') {
    return new Promise((resolve) => {
      // Stop any current speech
      this.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Female voice configuration
      const voices = this.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => 
        v.name.toLowerCase().includes('female') || 
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('victoria') ||
        !v.name.toLowerCase().includes('male')
      );
      
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      
      utterance.rate = 0.9;
      utterance.pitch = 1.2;
      utterance.volume = 1;
      
      utterance.onend = () => {
        this.isReading = false;
        resolve();
      };
      
      utterance.onerror = () => {
        this.isReading = false;
        resolve();
      };
      
      this.isReading = true;
      this.speechSynthesis.speak(utterance);
    });
  }

  // Stop speaking
  stopSpeaking() {
    this.speechSynthesis.cancel();
    this.isReading = false;
  }

  // Check if currently speaking
  isSpeaking() {
    return this.speechSynthesis.speaking || this.isReading;
  }

  // Confirm action
  async confirmAction(actionName) {
    const confirmation = `Are you sure you want to ${actionName}? Say yes to confirm, or no to cancel.`;
    await this.speak(confirmation, 'confirmation');
    
    return new Promise((resolve) => {
      const originalCallback = this.onCommandCallback;
      
      this.onCommandCallback = (command) => {
        if (command.type === 'confirm') {
          this.onCommandCallback = originalCallback;
          resolve(command.value);
        }
      };
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.onCommandCallback !== originalCallback) {
          this.onCommandCallback = originalCallback;
          resolve(false);
        }
      }, 10000);
    });
  }

  // Describe job opportunity (accessible format)
  describeJob(job, index, total) {
    let description = `Job ${index + 1} of ${total}. `;
    description += `Title: ${job.title}. `;
    description += `Company: ${job.company}. `;
    description += `Location: ${job.location}. `;
    
    if (job.salary) {
      description += `Salary: ${job.salary}. `;
    }
    
    if (job.required_skills && job.required_skills.length > 0) {
      description += `Required skills: ${job.required_skills.slice(0, 3).join(', ')}. `;
    }
    
    description += `Say 'details' for full description, 'apply' to apply for this job, 'next' for the next job, or 'back' for previous.`;
    
    return description;
  }

  // Start listening for commands
  startListening() {
    if (this.recognition) {
      this.recognition.start();
    }
  }

  // Stop listening
  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }
}

export const voiceAccessibility = new VoiceAccessibilityManager();
