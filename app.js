/**
 * PulseFit — Health, Nutrition, Workout & BMI Engine
 * Pure Vanilla JavaScript with LocalStorage State Management & Canvas Visuals
 */

(function () {
  'use strict';

  // --- Sound Effects using Web Audio API (Synthesized) ---
  class SoundManager {
    constructor() {
      this.enabled = true;
      this.audioCtx = null;
    }

    init() {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
    }

    playTone(freq, type = 'sine', duration = 0.15) {
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
      } catch (e) {
        // Audio might be blocked until gesture
      }
    }

    playSuccess() {
      if (!this.enabled) return;
      this.playTone(523.25, 'sine', 0.1); // C5
      setTimeout(() => this.playTone(659.25, 'sine', 0.15), 100); // E5
      setTimeout(() => this.playTone(783.99, 'sine', 0.25), 200); // G5
    }

    playWater() {
      if (!this.enabled) return;
      this.playTone(440, 'triangle', 0.1);
      setTimeout(() => this.playTone(587.33, 'sine', 0.15), 80);
    }

    playPop() {
      this.playTone(600, 'sine', 0.08);
    }
  }

  // --- Confetti Particle System ---
  class ConfettiCelebration {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.particles = [];
      this.animating = false;
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    fire() {
      if (!this.ctx) return;
      this.resize();
      const colors = ['#10b981', '#38bdf8', '#f59e0b', '#8b5cf6', '#f43f5e', '#ffffff'];
      for (let i = 0; i < 90; i++) {
        this.particles.push({
          x: this.canvas.width * (0.3 + Math.random() * 0.4),
          y: this.canvas.height * 0.4,
          vx: (Math.random() - 0.5) * 16,
          vy: -Math.random() * 14 - 4,
          size: Math.random() * 8 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          vRot: (Math.random() - 0.5) * 12,
          alpha: 1,
        });
      }
      if (!this.animating) {
        this.animating = true;
        this.loop();
      }
    }

    loop() {
      if (!this.particles.length) {
        this.animating = false;
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return;
      }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.vx *= 0.98;
        p.rotation += p.vRot;
        p.alpha -= 0.012;

        if (p.alpha <= 0 || p.y > this.canvas.height) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        this.ctx.restore();
      }
      requestAnimationFrame(() => this.loop());
    }
  }

  // --- Main Application Core ---
  class PulseFitApp {
    constructor() {
      this.sound = new SoundManager();
      this.confetti = new ConfettiCelebration('confetti-canvas');

      // Date state
      this.currentDate = this.formatDateKey(new Date());

      // Default Goals
      this.goals = {
        steps: 10000,
        water: 2500, // ml
        calories: 2200, // kcal
        protein: 120, // grams
        workoutMinutes: 45 // mins
      };

      // BMI unit mode
      this.bmiUnit = 'metric'; // 'metric' or 'imperial'

      // Advisor State (Goal: loss, maintain, gain | Pace: mild, standard, aggressive)
      this.advisorGoal = 'loss';
      this.advisorPace = 'standard';
      this.advisorRecommendedCalories = 1810;
      this.advisorRecommendedProtein = 140;

      // Prompt Modal callback
      this.promptCallback = null;

      this.init();
    }

    init() {
      this.loadGoals();
      this.loadAdvisorState();
      this.setupDOM();
      this.setupTabs();
      this.setDate(this.currentDate);
      this.calculateBMI(); // calculate initial BMI with default values
      this.calculateBmiAdvisor(); // calculate advisor recommendations
      this.renderCharts();
    }

    formatDateKey(d) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    loadGoals() {
      const saved = localStorage.getItem('pulsefit_goals');
      if (saved) {
        try {
          this.goals = Object.assign(this.goals, JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }

    saveGoals() {
      localStorage.setItem('pulsefit_goals', JSON.stringify(this.goals));
    }

    getDayData(dateKey = this.currentDate) {
      const key = `pulsefit_day_${dateKey}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
      return {
        steps: 0,
        water: 0,
        meals: [],
        workouts: []
      };
    }

    saveDayData(data, dateKey = this.currentDate) {
      const key = `pulsefit_day_${dateKey}`;
      localStorage.setItem(key, JSON.stringify(data));
      this.render();
    }

    // --- DOM Setup & Event Listeners ---
    setupDOM() {
      // Date Navigator buttons
      const prevBtn = document.getElementById('prev-day-btn');
      const nextBtn = document.getElementById('next-day-btn');
      const dateInput = document.getElementById('selected-date-input');

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          this.shiftDate(-1);
          this.sound.playPop();
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          this.shiftDate(1);
          this.sound.playPop();
        });
      }
      if (dateInput) {
        dateInput.addEventListener('change', (e) => {
          if (e.target.value) {
            this.setDate(e.target.value);
            this.sound.playPop();
          }
        });
      }

      // Goals Modal button
      const openGoalsBtn = document.getElementById('open-goals-modal-btn');
      if (openGoalsBtn) {
        openGoalsBtn.addEventListener('click', () => this.openGoalsModal());
      }

      // Sound Toggle
      const toggleSoundBtn = document.getElementById('toggle-sound-btn');
      if (toggleSoundBtn) {
        toggleSoundBtn.addEventListener('click', () => {
          this.sound.enabled = !this.sound.enabled;
          document.getElementById('sound-icon-on').classList.toggle('hidden', !this.sound.enabled);
          document.getElementById('sound-icon-off').classList.toggle('hidden', this.sound.enabled);
          this.showToast(this.sound.enabled ? 'Audio feedback enabled' : 'Audio feedback muted');
        });
      }

      // Workout form dynamic changes
      this.estimateWorkoutCalories();
    }

    setupTabs() {
      const tabs = document.querySelectorAll('.nav-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');

          const targetId = tab.getAttribute('data-tab');
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          const targetContent = document.getElementById(targetId);
          if (targetContent) {
            targetContent.classList.add('active');
          }

          if (targetId === 'analytics-tab') {
            this.renderCharts();
          }

          this.sound.playPop();
        });
      });
    }

    shiftDate(deltaDays) {
      const [y, m, d] = this.currentDate.split('-').map(Number);
      const cur = new Date(y, m - 1, d);
      cur.setDate(cur.getDate() + deltaDays);
      this.setDate(this.formatDateKey(cur));
    }

    setDate(dateKey) {
      this.currentDate = dateKey;
      const dateInput = document.getElementById('selected-date-input');
      if (dateInput) dateInput.value = dateKey;

      const dateLabel = document.getElementById('date-label');
      const todayKey = this.formatDateKey(new Date());

      if (dateKey === todayKey) {
        dateLabel.textContent = 'Today';
      } else {
        const [y, m, d] = dateKey.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dateLabel.textContent = dt.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
      }

      this.render();
    }

    // --- Toast Notifications ---
    showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `<span>${type === 'success' ? '✨' : 'ℹ️'}</span> ${message}`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
      }, 2600);
    }

    // --- Core Step Counter Logic ---
    adjustSteps(delta) {
      const data = this.getDayData();
      const prev = data.steps || 0;
      data.steps = Math.max(0, prev + delta);
      this.saveDayData(data);
      this.sound.playPop();
      const sign = delta > 0 ? '+' : '';
      this.showToast(`${sign}${delta.toLocaleString()} steps (${data.steps.toLocaleString()} total)`, delta > 0 ? 'success' : 'info');

      if (delta > 0 && data.steps >= this.goals.steps && prev < this.goals.steps) {
        this.confetti.fire();
        this.sound.playSuccess();
        this.showToast('🎉 Goal Achieved: 10,000 steps reached!', 'success');
      }
    }

    addSteps(count) {
      this.adjustSteps(count);
    }

    promptCustomSteps() {
      this.openPromptModal('Log Steps', 'Enter number of steps (positive or negative):', 'steps', (val) => {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num !== 0) {
          this.adjustSteps(num);
        }
      });
    }

    // --- Core Water Intake Logic ---
    adjustWater(delta) {
      const data = this.getDayData();
      const prev = data.water || 0;
      data.water = Math.max(0, prev + delta);
      this.saveDayData(data);
      this.sound.playWater();
      const sign = delta > 0 ? '+' : '';
      this.showToast(`${sign}${delta} ml water (${data.water.toLocaleString()} ml total)`, delta > 0 ? 'success' : 'info');

      if (delta > 0 && data.water >= this.goals.water && prev < this.goals.water) {
        this.confetti.fire();
        this.sound.playSuccess();
        this.showToast('🎉 Goal Achieved: Daily Hydration target met!', 'success');
      }
    }

    addWater(ml) {
      this.adjustWater(ml);
    }

    promptCustomWater() {
      this.openPromptModal('Log Water (ml)', 'Enter fluid amount in ml (positive or negative):', 'ml', (val) => {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num !== 0) {
          this.adjustWater(num);
        }
      });
    }

    // --- Nutrition: Food & Macro Logic ---
    openMealModal() {
      document.getElementById('meal-modal').classList.remove('hidden');
      document.getElementById('meal-name').focus();
    }

    closeMealModal() {
      document.getElementById('meal-modal').classList.add('hidden');
      document.getElementById('meal-form').reset();
    }

    fillMealPreset(name, cals, protein, type) {
      document.getElementById('meal-name').value = name;
      document.getElementById('meal-calories').value = cals;
      document.getElementById('meal-protein').value = protein;
      document.getElementById('meal-type').value = type;
    }

    saveMealEntry() {
      const name = document.getElementById('meal-name').value.trim();
      const calories = parseFloat(document.getElementById('meal-calories').value) || 0;
      const protein = parseFloat(document.getElementById('meal-protein').value) || 0;
      const type = document.getElementById('meal-type').value;

      if (!name) return;

      const data = this.getDayData();
      data.meals = data.meals || [];
      const newMeal = {
        id: 'meal_' + Date.now(),
        name,
        calories,
        protein,
        type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      data.meals.push(newMeal);
      this.saveDayData(data);
      this.closeMealModal();
      this.sound.playSuccess();
      this.showToast(`Logged "${name}" (${calories} kcal, ${protein}g protein)`, 'success');
    }

    deleteMealEntry(mealId) {
      const data = this.getDayData();
      data.meals = (data.meals || []).filter(m => m.id !== mealId);
      this.saveDayData(data);
      this.sound.playPop();
      this.showToast('Meal removed.');
    }

    adjustCalories(delta) {
      const data = this.getDayData();
      data.meals = data.meals || [];
      const currentCals = data.meals.reduce((acc, m) => acc + (parseFloat(m.calories) || 0), 0);
      let actualDelta = delta;
      if (currentCals + delta < 0) {
        actualDelta = -currentCals;
      }
      if (actualDelta === 0) return;

      const title = actualDelta > 0 ? 'Quick Calorie Add' : 'Calorie Reduction';
      data.meals.push({
        id: 'meal_' + Date.now(),
        name: title,
        calories: actualDelta,
        protein: 0,
        type: 'Quick Adjust',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      this.saveDayData(data);
      this.sound.playPop();
      const sign = actualDelta > 0 ? '+' : '';
      this.showToast(`${sign}${actualDelta} kcal (${Math.round(currentCals + actualDelta)} total)`, actualDelta > 0 ? 'success' : 'info');
    }

    adjustProtein(delta) {
      const data = this.getDayData();
      data.meals = data.meals || [];
      const currentProtein = data.meals.reduce((acc, m) => acc + (parseFloat(m.protein) || 0), 0);
      let actualDelta = delta;
      if (currentProtein + delta < 0) {
        actualDelta = -currentProtein;
      }
      if (actualDelta === 0) return;

      const title = actualDelta > 0 ? 'Quick Protein Add' : 'Protein Reduction';
      data.meals.push({
        id: 'meal_' + Date.now(),
        name: title,
        calories: 0,
        protein: actualDelta,
        type: 'Quick Adjust',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      this.saveDayData(data);
      this.sound.playPop();
      const sign = actualDelta > 0 ? '+' : '';
      this.showToast(`${sign}${actualDelta}g protein (${(currentProtein + actualDelta).toFixed(1)}g total)`, actualDelta > 0 ? 'success' : 'info');
    }

    deleteWorkoutEntry(workoutId) {
      const data = this.getDayData();
      data.workouts = (data.workouts || []).filter(w => w.id !== workoutId);
      this.saveDayData(data);
      this.sound.playPop();
      this.showToast('Workout entry removed.');
    }

    // --- Workout Modal & Estimations ---
    openWorkoutModal() {
      document.getElementById('workout-modal').classList.remove('hidden');
      this.estimateWorkoutCalories();
    }

    closeWorkoutModal() {
      document.getElementById('workout-modal').classList.add('hidden');
      document.getElementById('workout-form').reset();
    }

    onWorkoutTypeChange() {
      this.estimateWorkoutCalories();
    }

    estimateWorkoutCalories() {
      const type = document.getElementById('workout-type').value;
      const duration = parseFloat(document.getElementById('workout-duration').value) || 0;
      const intensity = document.getElementById('workout-intensity').value;

      // Base MET values for common sports
      const metTable = {
        'Weight Training': 5.0,
        'Running': 9.5,
        'Cycling': 7.5,
        'HIIT Cardio': 8.5,
        'Swimming': 8.0,
        'Yoga / Mobility': 3.0,
        'Brisk Walking': 4.0,
        'Pilates': 4.0,
        'Other Sport': 6.0
      };

      let baseMet = metTable[type] || 5.0;
      if (intensity === 'Light') baseMet *= 0.8;
      if (intensity === 'Vigorous') baseMet *= 1.25;

      const estKcal = Math.round(baseMet * 3.5 * 70 / 200 * duration);
      const calInput = document.getElementById('workout-calories');
      if (calInput) calInput.value = estKcal;
    }

    saveWorkoutEntry() {
      const type = document.getElementById('workout-type').value;
      const duration = parseInt(document.getElementById('workout-duration').value, 10) || 0;
      const intensity = document.getElementById('workout-intensity').value;
      const calories = parseInt(document.getElementById('workout-calories').value, 10) || 0;
      const notes = document.getElementById('workout-notes').value.trim();

      const data = this.getDayData();
      data.workouts = data.workouts || [];
      const newWorkout = {
        id: 'workout_' + Date.now(),
        type,
        duration,
        intensity,
        calories,
        notes,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      data.workouts.push(newWorkout);
      this.saveDayData(data);
      this.closeWorkoutModal();
      this.sound.playSuccess();
      this.confetti.fire();
      this.showToast(`Logged ${duration}m ${type} (${calories} kcal burned)! 🔥`, 'success');
    }

    adjustWorkoutDuration(deltaMinutes) {
      const data = this.getDayData();
      data.workouts = data.workouts || [];
      const currentMins = data.workouts.reduce((acc, w) => acc + (parseInt(w.duration, 10) || 0), 0);

      if (deltaMinutes < 0 && currentMins <= 0) return;

      if (data.workouts.length === 0 && deltaMinutes > 0) {
        data.workouts.push({
          id: 'workout_' + Date.now(),
          type: 'Active Exercise',
          duration: deltaMinutes,
          intensity: 'Moderate',
          calories: Math.round(deltaMinutes * 7.5),
          notes: 'Quick adjusted session',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } else if (data.workouts.length > 0) {
        const last = data.workouts[data.workouts.length - 1];
        const newDuration = Math.max(0, (last.duration || 0) + deltaMinutes);
        if (newDuration === 0) {
          data.workouts.pop();
        } else {
          last.duration = newDuration;
          last.calories = Math.max(0, Math.round(newDuration * 7.5));
        }
      }
      this.saveDayData(data);
      this.sound.playPop();
      const sign = deltaMinutes > 0 ? '+' : '';
      const updatedMins = Math.max(0, currentMins + deltaMinutes);
      this.showToast(`${sign}${deltaMinutes} mins workout (${updatedMins}m total)`, deltaMinutes > 0 ? 'success' : 'info');
    }

    // --- Daily Goals Modal Logic ---
    openGoalsModal() {
      document.getElementById('goal-steps-input').value = this.goals.steps;
      document.getElementById('goal-water-input').value = this.goals.water;
      document.getElementById('goal-calories-input').value = this.goals.calories;
      document.getElementById('goal-protein-input').value = this.goals.protein;
      document.getElementById('goal-workout-input').value = this.goals.workoutMinutes;
      document.getElementById('goals-modal').classList.remove('hidden');
    }

    closeGoalsModal() {
      document.getElementById('goals-modal').classList.add('hidden');
    }

    saveDailyGoals() {
      this.goals.steps = parseInt(document.getElementById('goal-steps-input').value, 10) || 10000;
      this.goals.water = parseInt(document.getElementById('goal-water-input').value, 10) || 2500;
      this.goals.calories = parseInt(document.getElementById('goal-calories-input').value, 10) || 2200;
      this.goals.protein = parseFloat(document.getElementById('goal-protein-input').value) || 120;
      this.goals.workoutMinutes = parseInt(document.getElementById('goal-workout-input').value, 10) || 45;

      this.saveGoals();
      this.closeGoalsModal();
      this.render();
      this.showToast('Daily goals updated successfully!', 'success');
    }

    // --- Prompt Modal (Custom amounts) ---
    openPromptModal(title, label, unit, callback) {
      document.getElementById('prompt-modal-title').textContent = title;
      document.getElementById('prompt-modal-label').textContent = label;
      document.getElementById('prompt-modal-unit').textContent = unit;
      const input = document.getElementById('prompt-modal-input');
      input.value = '';
      this.promptCallback = callback;
      document.getElementById('prompt-modal').classList.remove('hidden');
      setTimeout(() => input.focus(), 50);
    }

    closePromptModal() {
      document.getElementById('prompt-modal').classList.add('hidden');
      this.promptCallback = null;
    }

    confirmPromptModal() {
      const val = document.getElementById('prompt-modal-input').value;
      if (this.promptCallback) {
        this.promptCallback(val);
      }
      this.closePromptModal();
    }

    // ==========================================================================
    // BMI CALCULATOR & SCIENTIFIC HEALTH ENGINE
    // ==========================================================================
    setBmiUnit(mode) {
      this.bmiUnit = mode;
      document.getElementById('unit-metric-btn').classList.toggle('active', mode === 'metric');
      document.getElementById('unit-imperial-btn').classList.toggle('active', mode === 'imperial');

      const metricGroup = document.getElementById('metric-inputs-group');
      const imperialGroup = document.getElementById('imperial-inputs-group');

      if (mode === 'metric') {
        metricGroup.classList.remove('hidden');
        imperialGroup.classList.add('hidden');
      } else {
        metricGroup.classList.add('hidden');
        imperialGroup.classList.remove('hidden');
      }
      this.calculateBMI();
    }

    calculateBMI() {
      let heightCm = 0;
      let weightKg = 0;

      if (this.bmiUnit === 'metric') {
        heightCm = parseFloat(document.getElementById('bmi-height-cm').value) || 175;
        weightKg = parseFloat(document.getElementById('bmi-weight-kg').value) || 70;
      } else {
        const ft = parseFloat(document.getElementById('bmi-height-ft').value) || 5;
        const inc = parseFloat(document.getElementById('bmi-height-in').value) || 9;
        const lbs = parseFloat(document.getElementById('bmi-weight-lbs').value) || 154;

        heightCm = (ft * 12 + inc) * 2.54;
        weightKg = lbs * 0.45359237;
      }

      const gender = document.getElementById('bmi-gender').value;
      const age = parseInt(document.getElementById('bmi-age').value, 10) || 25;
      const activityFactor = parseFloat(document.getElementById('bmi-activity').value) || 1.375;

      const heightM = heightCm / 100;
      if (heightM <= 0 || weightKg <= 0) return;

      const bmi = weightKg / (heightM * heightM);
      const bmiRounded = bmi.toFixed(1);

      // BMI Categories & Colors
      let category = 'Normal Weight';
      let categoryClass = 'normal';
      let advice = 'Your BMI is within the healthy zone recommended by the World Health Organization (WHO). Maintain balanced nutrition and steady physical activity!';

      if (bmi < 18.5) {
        category = 'Underweight';
        categoryClass = 'underweight';
        advice = 'Your BMI is below the healthy range. Consider nutrient-dense, protein-rich nutrition and strength training to build lean body mass safely.';
      } else if (bmi >= 18.5 && bmi < 25) {
        category = 'Normal Weight';
        categoryClass = 'normal';
        advice = 'Your BMI is in the optimal range. Keep up consistent hydration, regular workouts, and wholesome macro balance.';
      } else if (bmi >= 25 && bmi < 30) {
        category = 'Overweight';
        categoryClass = 'overweight';
        advice = 'Your BMI is in the overweight zone. A moderate caloric deficit coupled with daily steps and resistance training can help lean down.';
      } else {
        category = 'Obese';
        categoryClass = 'obese';
        advice = 'Your BMI is in the obese category. Prioritize progressive walking, structured nutrition, hydration, and consult a physician.';
      }

      // Update UI displays
      document.getElementById('bmi-value-display').textContent = bmiRounded;
      document.getElementById('bmi-category-title').textContent = category;
      document.getElementById('bmi-category-advice').textContent = advice;

      const badge = document.getElementById('bmi-category-badge');
      badge.textContent = category;
      badge.className = `bmi-badge ${categoryClass}`;

      // Update Needle on Gauge (scale maps from BMI 16 to 40)
      const minBmi = 16.0;
      const maxBmi = 40.0;
      const clampedBmi = Math.min(Math.max(bmi, minBmi), maxBmi);
      const pct = ((clampedBmi - minBmi) / (maxBmi - minBmi)) * 100;

      const needle = document.getElementById('bmi-gauge-needle');
      needle.style.left = `${pct}%`;
      document.getElementById('needle-score-label').textContent = bmiRounded;

      // Color Circle border
      const circleWrap = document.getElementById('bmi-circle-wrap');
      const colorsMap = {
        underweight: '#38bdf8',
        normal: '#10b981',
        overweight: '#f59e0b',
        obese: '#ef4444'
      };
      circleWrap.style.borderColor = colorsMap[categoryClass];
      circleWrap.style.boxShadow = `0 0 20px ${colorsMap[categoryClass]}44`;

      // 1. Ideal Weight Range (BMI 18.5 - 24.9)
      const minIdealKg = (18.5 * heightM * heightM).toFixed(1);
      const maxIdealKg = (24.9 * heightM * heightM).toFixed(1);
      if (this.bmiUnit === 'metric') {
        document.getElementById('bmi-ideal-weight').textContent = `${minIdealKg} – ${maxIdealKg} kg`;
      } else {
        const minLbs = (minIdealKg * 2.20462).toFixed(1);
        const maxLbs = (maxIdealKg * 2.20462).toFixed(1);
        document.getElementById('bmi-ideal-weight').textContent = `${minLbs} – ${maxLbs} lbs`;
      }

      // 2. Basal Metabolic Rate (BMR) - Mifflin-St Jeor Equation
      // Men: 10 * weight (kg) + 6.25 * height (cm) - 5 * age + 5
      // Women: 10 * weight (kg) + 6.25 * height (cm) - 5 * age - 161
      let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
      bmr += (gender === 'male' ? 5 : -161);
      const bmrRounded = Math.round(bmr);
      document.getElementById('bmi-bmr-display').textContent = `${bmrRounded.toLocaleString()} kcal`;

      // 3. TDEE (Total Daily Energy Expenditure)
      const tdee = Math.round(bmrRounded * activityFactor);
      document.getElementById('bmi-tdee-display').textContent = `${tdee.toLocaleString()} kcal`;

      // 4. Recommended Protein (1.6g - 2.0g per kg of bodyweight)
      const minProtein = Math.round(weightKg * 1.6);
      const maxProtein = Math.round(weightKg * 2.0);
      document.getElementById('bmi-recommended-protein').textContent = `${minProtein} – ${maxProtein} g`;

      // Cache calculated recommendations for syncing
      this.calculatedTdee = tdee;
      this.calculatedProtein = Math.round((minProtein + maxProtein) / 2);

      // Sync with Dashboard Advisor Controls if not currently editing
      const advGender = document.getElementById('advisor-gender');
      const advAge = document.getElementById('advisor-age');
      const advHeight = document.getElementById('advisor-height');
      const advWeight = document.getElementById('advisor-weight');
      const advActivity = document.getElementById('advisor-activity');

      if (advGender && document.activeElement !== advGender) advGender.value = gender;
      if (advAge && document.activeElement !== advAge) advAge.value = age;
      if (advHeight && document.activeElement !== advHeight) advHeight.value = Math.round(heightCm);
      if (advWeight && document.activeElement !== advWeight) advWeight.value = weightKg.toFixed(1);
      if (advActivity && document.activeElement !== advActivity) advActivity.value = activityFactor;

      this.calculateBmiAdvisor();
    }

    applyBmiRecommendations() {
      if (!this.calculatedTdee) this.calculateBMI();
      this.goals.calories = this.calculatedTdee;
      this.goals.protein = this.calculatedProtein;
      this.saveGoals();
      this.render();
      this.sound.playSuccess();
      this.showToast(`Applied BMI recommendations: ${this.goals.calories} kcal & ${this.goals.protein}g protein!`, 'success');
    }

    // ==========================================================================
    // BMI NUTRITION TARGET ADVISOR (WEIGHT LOSS, MAINTENANCE & WEIGHT GAIN)
    // ==========================================================================
    calculateBmiAdvisor() {
      const genderEl = document.getElementById('advisor-gender');
      const ageEl = document.getElementById('advisor-age');
      const heightEl = document.getElementById('advisor-height');
      const weightEl = document.getElementById('advisor-weight');
      const activityEl = document.getElementById('advisor-activity');

      if (!genderEl || !ageEl || !heightEl || !weightEl || !activityEl) return;

      const gender = genderEl.value;
      const age = parseInt(ageEl.value, 10) || 25;
      const heightCm = parseFloat(heightEl.value) || 175;
      const weightKg = parseFloat(weightEl.value) || 70;
      const activityFactor = parseFloat(activityEl.value) || 1.375;

      const heightM = heightCm / 100;
      if (heightM <= 0 || weightKg <= 0) return;

      const bmi = weightKg / (heightM * heightM);
      const bmiRounded = bmi.toFixed(1);

      // BMI Category & Status
      let category = 'Normal';
      let categoryClass = 'normal';
      if (bmi < 18.5) {
        category = 'Underweight';
        categoryClass = 'underweight';
      } else if (bmi >= 18.5 && bmi < 25) {
        category = 'Normal';
        categoryClass = 'normal';
      } else if (bmi >= 25 && bmi < 30) {
        category = 'Overweight';
        categoryClass = 'overweight';
      } else {
        category = 'Obese';
        categoryClass = 'obese';
      }

      // Update badge
      const badge = document.getElementById('advisor-bmi-badge');
      if (badge) {
        badge.textContent = `BMI ${bmiRounded} • ${category}`;
        badge.className = `card-stat-pill advisor-bmi-pill ${categoryClass}`;
      }

      // Basal Metabolic Rate (Mifflin-St Jeor)
      let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
      bmr += (gender === 'male' ? 5 : -161);
      const bmrRounded = Math.round(bmr);
      const tdee = Math.round(bmrRounded * activityFactor);

      // Pace adjustments based on selected goal
      const goal = this.advisorGoal || 'loss';
      const pace = this.advisorPace || 'standard';

      let calDelta = 0;
      let rateText = '';
      let deltaText = '';
      const minSafeCals = gender === 'male' ? 1500 : 1200;

      // Update pace sublabels based on goal
      const mildSub = document.getElementById('pace-mild-sub');
      const stdSub = document.getElementById('pace-standard-sub');
      const aggSub = document.getElementById('pace-aggressive-sub');

      if (goal === 'loss') {
        if (mildSub) mildSub.textContent = '-250 kcal/d (~0.25kg/wk)';
        if (stdSub) stdSub.textContent = '-500 kcal/d (~0.5kg/wk)';
        if (aggSub) aggSub.textContent = '-750 kcal/d (~0.75kg/wk)';

        if (pace === 'mild') {
          calDelta = -250;
          rateText = '~0.25 kg fat loss / wk';
          deltaText = '−250 kcal deficit';
        } else if (pace === 'aggressive') {
          calDelta = -750;
          rateText = '~0.75 kg fat loss / wk';
          deltaText = '−750 kcal deficit';
        } else {
          calDelta = -500;
          rateText = '~0.5 kg fat loss / wk';
          deltaText = '−500 kcal deficit';
        }
      } else if (goal === 'gain') {
        if (mildSub) mildSub.textContent = '+250 kcal/d (Lean bulk)';
        if (stdSub) stdSub.textContent = '+400 kcal/d (~0.35kg/wk)';
        if (aggSub) aggSub.textContent = '+650 kcal/d (Rapid mass)';

        if (pace === 'mild') {
          calDelta = 250;
          rateText = '~0.2 kg gain / wk';
          deltaText = '+250 kcal surplus';
        } else if (pace === 'aggressive') {
          calDelta = 650;
          rateText = '~0.55 kg gain / wk';
          deltaText = '+650 kcal surplus';
        } else {
          calDelta = 400;
          rateText = '~0.35 kg gain / wk';
          deltaText = '+400 kcal surplus';
        }
      } else { // maintain
        if (mildSub) mildSub.textContent = 'Exact TDEE Balance';
        if (stdSub) stdSub.textContent = 'Exact TDEE Balance';
        if (aggSub) aggSub.textContent = 'Exact TDEE Balance';

        calDelta = 0;
        rateText = 'Weight Maintenance';
        deltaText = '±0 kcal (Neutral balance)';
      }

      let recCalories = Math.round(tdee + calDelta);
      if (goal === 'loss' && recCalories < minSafeCals) {
        recCalories = minSafeCals;
        deltaText = `−${tdee - minSafeCals} kcal (Safe Floor)`;
      }

      // Protein recommendation calculation according to BMI & Goal
      let proteinMultiplier = 1.8;
      let proteinRationale = 'Optimal daily recovery';

      if (goal === 'loss') {
        // High protein during deficit to preserve lean body mass
        if (bmi >= 30) {
          proteinMultiplier = 1.7; // Avoid excessively inflated total grams for obese category
          proteinRationale = 'Protects muscle in deficit';
        } else if (bmi >= 25) {
          proteinMultiplier = 1.9;
          proteinRationale = 'Muscle sparing & high satiety';
        } else {
          proteinMultiplier = 2.0;
          proteinRationale = 'Prevents lean muscle catabolism';
        }
      } else if (goal === 'gain') {
        // Muscle building surplus
        if (bmi < 18.5) {
          proteinMultiplier = 2.0;
          proteinRationale = 'Fuels lean mass restoration';
        } else if (bmi >= 25) {
          proteinMultiplier = 1.8;
          proteinRationale = 'Lean recomposition target';
        } else {
          proteinMultiplier = 1.9;
          proteinRationale = 'Maximizes muscle protein synthesis';
        }
      } else { // maintain
        proteinMultiplier = 1.6;
        proteinRationale = 'Cellular repair & health';
      }

      const recProtein = Math.round(weightKg * proteinMultiplier);
      const proteinCalories = recProtein * 4;
      const proteinPct = Math.min(50, Math.round((proteinCalories / recCalories) * 100));

      // Healthy Fats (25-30% of total calories)
      const fatPct = 28;
      const fatCalories = Math.round(recCalories * (fatPct / 100));
      const recFats = Math.round(fatCalories / 9);

      // Carbohydrates (Remaining calories)
      const remainingCals = Math.max(100, recCalories - proteinCalories - (recFats * 9));
      const recCarbs = Math.round(remainingCals / 4);
      const carbPct = Math.max(10, 100 - proteinPct - fatPct);

      // Dynamic Guidance Notes based on BMI + Goal combination
      let guidanceTitle = 'Personalized Nutrition Strategy';
      let guidanceText = '';

      if (goal === 'loss') {
        guidanceTitle = `Weight Loss Strategy (BMI ${bmiRounded} • ${category})`;
        if (bmi >= 25) {
          guidanceText = `Your BMI is in the ${category.toLowerCase()} zone. A controlled ${Math.abs(calDelta)} kcal deficit paired with ${recProtein}g protein (${proteinMultiplier}g/kg) creates sustainable fat loss while preserving resting metabolic rate. Aim for 8,000–10,000 daily steps.`;
        } else if (bmi < 18.5) {
          guidanceText = `Notice: Your BMI of ${bmiRounded} is classified as underweight. Further caloric deficit is not clinically recommended. Consider switching to Maintenance or Weight Gain to protect hormonal and bone health.`;
        } else {
          guidanceText = `With a healthy BMI of ${bmiRounded}, a moderate ${Math.abs(calDelta)} kcal deficit paired with high protein (${recProtein}g/day) targets stubborn fat while protecting lean muscle mass. Incorporate resistance training 3–4 days/week.`;
        }
      } else if (goal === 'gain') {
        guidanceTitle = `Weight Gain & Hypertrophy Strategy (BMI ${bmiRounded} • ${category})`;
        if (bmi < 18.5) {
          guidanceText = `Your BMI is in the underweight range. A steady ${calDelta} kcal caloric surplus with ${recProtein}g protein (${proteinMultiplier}g/kg), complex carbs, and progressive resistance training will help build functional muscle tissue and healthy body mass safely.`;
        } else if (bmi >= 25) {
          guidanceText = `Your BMI is currently ${bmiRounded} (${category}). To gain muscle without unwanted fat gain, stick to a mild lean surplus (+250 kcal) with high protein (${recProtein}g/day) and progressive overload strength training.`;
        } else {
          guidanceText = `In optimal health (BMI ${bmiRounded}), a clean ${calDelta} kcal surplus provides the energy required for hypertrophy without excess adiposity. Fuel workouts with ${recCarbs}g carbs and recover with ${recProtein}g protein.`;
        }
      } else {
        guidanceTitle = `Weight Maintenance & Recomposition (BMI ${bmiRounded} • ${category})`;
        guidanceText = `Your maintenance intake is ${tdee.toLocaleString()} kcal/day. Consuming ${recProtein}g protein daily provides the building blocks for body recomposition—simultaneously firming muscle tone and burning fat while keeping your weight steady.`;
      }

      // Cache recommendation
      this.advisorRecommendedCalories = recCalories;
      this.advisorRecommendedProtein = recProtein;

      // Update DOM displays
      const calValEl = document.getElementById('advisor-cal-val');
      const protValEl = document.getElementById('advisor-protein-val');
      if (calValEl) calValEl.textContent = recCalories.toLocaleString();
      if (protValEl) protValEl.textContent = recProtein;

      const rateTag = document.getElementById('advisor-rate-tag');
      if (rateTag) rateTag.textContent = rateText;

      const deltaTextEl = document.getElementById('advisor-cal-delta-text');
      if (deltaTextEl) deltaTextEl.textContent = deltaText;

      const tdeeRefEl = document.getElementById('advisor-tdee-ref-text');
      if (tdeeRefEl) tdeeRefEl.textContent = `TDEE: ${tdee.toLocaleString()} kcal`;

      const proteinRatioTag = document.getElementById('advisor-protein-ratio-tag');
      if (proteinRatioTag) proteinRatioTag.textContent = `${proteinMultiplier} g / kg`;

      const proteinKcalText = document.getElementById('advisor-protein-kcal-text');
      if (proteinKcalText) proteinKcalText.textContent = `${proteinCalories} kcal (${proteinPct}% of total)`;

      const proteinRationaleEl = document.getElementById('advisor-protein-rationale');
      if (proteinRationaleEl) proteinRationaleEl.textContent = proteinRationale;

      // Macro Breakdown
      const macroProtEl = document.getElementById('advisor-macro-prot');
      const macroCarbsEl = document.getElementById('advisor-macro-carbs');
      const macroFatsEl = document.getElementById('advisor-macro-fats');
      if (macroProtEl) macroProtEl.textContent = `${recProtein}g (${proteinPct}%)`;
      if (macroCarbsEl) macroCarbsEl.textContent = `${recCarbs}g (${carbPct}%)`;
      if (macroFatsEl) macroFatsEl.textContent = `${recFats}g (${fatPct}%)`;

      const segProt = document.getElementById('macro-seg-protein');
      const segCarbs = document.getElementById('macro-seg-carbs');
      const segFats = document.getElementById('macro-seg-fats');
      if (segProt) segProt.style.width = `${proteinPct}%`;
      if (segCarbs) segCarbs.style.width = `${carbPct}%`;
      if (segFats) segFats.style.width = `${fatPct}%`;

      // Guidance Box
      const guideTitleEl = document.getElementById('advisor-guidance-title');
      const guideTextEl = document.getElementById('advisor-guidance-text');
      if (guideTitleEl) guideTitleEl.textContent = guidanceTitle;
      if (guideTextEl) guideTextEl.textContent = guidanceText;
    }

    setAdvisorGoal(goal) {
      this.advisorGoal = goal;
      ['loss', 'maintain', 'gain'].forEach(g => {
        const btn = document.getElementById(`goal-btn-${g}`);
        if (btn) btn.classList.toggle('active', g === goal);
      });
      this.saveAdvisorState();
      this.calculateBmiAdvisor();
      this.sound.playPop();
    }

    setAdvisorPace(pace) {
      this.advisorPace = pace;
      ['mild', 'standard', 'aggressive'].forEach(p => {
        const btn = document.getElementById(`pace-${p}-btn`);
        if (btn) btn.classList.toggle('active', p === pace);
      });
      this.saveAdvisorState();
      this.calculateBmiAdvisor();
      this.sound.playPop();
    }

    onAdvisorProfileInput() {
      const gender = document.getElementById('advisor-gender').value;
      const age = document.getElementById('advisor-age').value;
      const height = document.getElementById('advisor-height').value;
      const weight = document.getElementById('advisor-weight').value;
      const activity = document.getElementById('advisor-activity').value;

      const bmiGender = document.getElementById('bmi-gender');
      const bmiAge = document.getElementById('bmi-age');
      const bmiHeight = document.getElementById('bmi-height-cm');
      const bmiWeight = document.getElementById('bmi-weight-kg');
      const bmiActivity = document.getElementById('bmi-activity');

      if (bmiGender) bmiGender.value = gender;
      if (bmiAge) bmiAge.value = age;
      if (bmiHeight) bmiHeight.value = height;
      if (bmiWeight) bmiWeight.value = weight;
      if (bmiActivity) bmiActivity.value = activity;

      this.calculateBMI();
      this.calculateBmiAdvisor();
    }

    applyAdvisorGoals() {
      if (!this.advisorRecommendedCalories) this.calculateBmiAdvisor();
      this.goals.calories = this.advisorRecommendedCalories;
      this.goals.protein = this.advisorRecommendedProtein;
      this.saveGoals();
      this.render();
      this.sound.playSuccess();
      this.confetti.fire();

      const goalLabelMap = {
        loss: 'Weight Loss Target',
        maintain: 'Maintenance Target',
        gain: 'Weight Gain Target'
      };
      const label = goalLabelMap[this.advisorGoal] || 'Nutrition Target';
      this.showToast(`Applied ${label}: ${this.goals.calories.toLocaleString()} kcal & ${this.goals.protein}g protein!`, 'success');
    }

    fillGoalsFromAdvisor(goal) {
      this.advisorGoal = goal;
      ['loss', 'maintain', 'gain'].forEach(g => {
        const btn = document.getElementById(`goal-btn-${g}`);
        if (btn) btn.classList.toggle('active', g === goal);
      });
      this.calculateBmiAdvisor();
      const calInput = document.getElementById('goal-calories-input');
      const protInput = document.getElementById('goal-protein-input');
      if (calInput) calInput.value = this.advisorRecommendedCalories;
      if (protInput) protInput.value = this.advisorRecommendedProtein;
      this.sound.playPop();
      this.showToast(`Auto-filled ${goal.toUpperCase()} targets into form!`, 'info');
    }

    scrollToAdvisor() {
      const el = document.getElementById('card-bmi-advisor');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 30px rgba(56, 189, 248, 0.7)';
        setTimeout(() => {
          el.style.boxShadow = '';
        }, 1600);
      }
    }

    switchToBmiTab() {
      const bmiTabBtn = document.querySelector('.nav-tab[data-tab="bmi-tab"]');
      if (bmiTabBtn) {
        bmiTabBtn.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    loadAdvisorState() {
      const saved = localStorage.getItem('pulsefit_advisor');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.advisorGoal = parsed.goal || 'loss';
          this.advisorPace = parsed.pace || 'standard';
        } catch (e) {}
      }
      ['loss', 'maintain', 'gain'].forEach(g => {
        const btn = document.getElementById(`goal-btn-${g}`);
        if (btn) btn.classList.toggle('active', g === this.advisorGoal);
      });
      ['mild', 'standard', 'aggressive'].forEach(p => {
        const btn = document.getElementById(`pace-${p}-btn`);
        if (btn) btn.classList.toggle('active', p === this.advisorPace);
      });
    }

    saveAdvisorState() {
      localStorage.setItem('pulsefit_advisor', JSON.stringify({
        goal: this.advisorGoal,
        pace: this.advisorPace
      }));
    }

    // Smooth numeric count-up interpolation animation
    animateCount(elementId, targetValue, duration = 380, formatFn = (n) => Math.round(n).toLocaleString()) {
      const el = document.getElementById(elementId);
      if (!el) return;
      const startValue = parseFloat(el.dataset.currentVal) || 0;
      el.dataset.currentVal = targetValue;
      if (Math.abs(startValue - targetValue) < 0.05) {
        el.textContent = formatFn(targetValue);
        return;
      }

      const startTime = performance.now();
      const step = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out
        const current = startValue + (targetValue - startValue) * ease;
        el.textContent = formatFn(current);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = formatFn(targetValue);
        }
      };
      requestAnimationFrame(step);
    }

    // ==========================================================================
    // RENDER MAIN DASHBOARD
    // ==========================================================================
    render() {
      const data = this.getDayData();

      // --- 1. Step Counter ---
      const steps = data.steps || 0;
      const stepPct = Math.min(100, Math.round((steps / this.goals.steps) * 100));
      this.animateCount('steps-count-display', steps);
      document.getElementById('steps-goal-display').textContent = this.goals.steps.toLocaleString();
      document.getElementById('steps-pct-pill').textContent = `${stepPct}%`;
      document.getElementById('steps-progress-bar').style.width = `${stepPct}%`;

      // Distance estimation (average stride: ~0.762m / 1312 steps per km)
      const km = (steps / 1312).toFixed(1);
      document.getElementById('steps-km-display').textContent = `${km} km`;

      // Estimated active burn from steps (~0.04 kcal per step)
      const stepKcal = Math.round(steps * 0.04);
      document.getElementById('steps-kcal-display').textContent = `${stepKcal} kcal`;

      // --- 2. Water Intake ---
      const water = data.water || 0;
      const waterPct = Math.min(100, Math.round((water / this.goals.water) * 100));
      this.animateCount('water-count-display', water);
      document.getElementById('water-goal-display').textContent = this.goals.water.toLocaleString();
      document.getElementById('water-pct-pill').textContent = `${waterPct}%`;
      document.getElementById('water-progress-bar').style.width = `${waterPct}%`;
      document.getElementById('water-cup-fill').style.height = `${waterPct}%`;

      const remainingWater = Math.max(0, this.goals.water - water);
      const cupsRemaining = Math.ceil(remainingWater / 250);
      document.getElementById('water-cups-left').textContent =
        remainingWater > 0
          ? `${cupsRemaining} glasses (250ml) remaining`
          : '✨ Daily water goal reached! Stay hydrated!';

      // --- 3. Nutrition: Calories & Protein ---
      const meals = data.meals || [];
      const totalCalories = meals.reduce((acc, m) => acc + (parseFloat(m.calories) || 0), 0);
      const totalProtein = meals.reduce((acc, m) => acc + (parseFloat(m.protein) || 0), 0);

      const calPct = Math.min(100, Math.round((totalCalories / this.goals.calories) * 100));
      const proteinPct = Math.min(100, Math.round((totalProtein / this.goals.protein) * 100));

      this.animateCount('cal-count-display', Math.round(totalCalories));
      document.getElementById('cal-goal-display').textContent = this.goals.calories.toLocaleString();
      document.getElementById('cal-progress-bar').style.width = `${calPct}%`;

      const calRem = this.goals.calories - totalCalories;
      document.getElementById('cal-remaining-display').textContent =
        calRem >= 0 ? `${Math.round(calRem).toLocaleString()} kcal remaining` : `${Math.round(Math.abs(calRem)).toLocaleString()} kcal over budget`;

      this.animateCount('protein-count-display', totalProtein, 380, (n) => n.toFixed(1));
      document.getElementById('protein-goal-display').textContent = this.goals.protein;
      document.getElementById('protein-progress-bar').style.width = `${proteinPct}%`;

      const protRem = this.goals.protein - totalProtein;
      document.getElementById('protein-remaining-display').textContent =
        protRem > 0 ? `${protRem.toFixed(1)} g remaining` : '🎉 Protein target achieved!';

      document.getElementById('meal-count-pill').textContent = meals.length;

      // Render Meal List with friendly empty state
      const mealListContainer = document.getElementById('meal-list-container');
      if (meals.length === 0) {
        mealListContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
            </div>
            <p class="empty-title">No meals logged yet today</p>
            <span class="empty-sub">Fuel your recovery! Click "+ Add Food" above to track your calories & protein.</span>
          </div>
        `;
      } else {
        mealListContainer.innerHTML = meals.map(meal => `
          <div class="log-entry-row">
            <div class="entry-info">
              <span class="entry-title">${this.escapeHtml(meal.name)}</span>
              <span class="entry-meta">
                <span>🔥 ${meal.calories} kcal</span>
                <span>🥩 ${meal.protein}g protein</span>
                <span>🏷️ ${this.escapeHtml(meal.type)}</span>
                <span>⏰ ${meal.time || ''}</span>
              </span>
            </div>
            <button class="entry-delete-btn" onclick="app.deleteMealEntry('${meal.id}')" title="Delete entry" aria-label="Delete ${this.escapeHtml(meal.name)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `).join('');
      }

      // --- 4. Workouts & Activity ---
      const workouts = data.workouts || [];
      const totalMinutes = workouts.reduce((acc, w) => acc + (parseInt(w.duration, 10) || 0), 0);
      const totalWorkoutCalories = workouts.reduce((acc, w) => acc + (parseInt(w.calories, 10) || 0), 0);

      this.animateCount('workout-total-minutes', totalMinutes);
      this.animateCount('workout-total-calories', totalWorkoutCalories);
      document.getElementById('workout-total-sessions').textContent = workouts.length;
      document.getElementById('workout-minutes-goal-meta').textContent = `Target: ${this.goals.workoutMinutes}m`;

      const workoutPct = Math.min(100, Math.round((totalMinutes / this.goals.workoutMinutes) * 100));
      document.getElementById('workout-progress-bar').style.width = `${workoutPct}%`;

      // Render Workout List with friendly empty state
      const workoutListContainer = document.getElementById('workout-list-container');
      if (workouts.length === 0) {
        workoutListContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 5v14M18 5v14M2 9v6M22 9v6M6 12h12"/></svg>
            </div>
            <p class="empty-title">No workout sessions logged</p>
            <span class="empty-sub">Ready to move? Log gym training, running, cycling, or yoga above.</span>
          </div>
        `;
      } else {
        workoutListContainer.innerHTML = workouts.map(workout => `
          <div class="log-entry-row">
            <div class="entry-info">
              <span class="entry-title">${this.escapeHtml(workout.type)} — ${workout.duration} mins</span>
              <span class="entry-meta">
                <span>🔥 ${workout.calories} kcal burned</span>
                <span>⚡ ${workout.intensity}</span>
                ${workout.notes ? `<span>📝 ${this.escapeHtml(workout.notes)}</span>` : ''}
                <span>⏰ ${workout.time || ''}</span>
              </span>
            </div>
            <button class="entry-delete-btn" onclick="app.deleteWorkoutEntry('${workout.id}')" title="Delete workout" aria-label="Delete ${this.escapeHtml(workout.type)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `).join('');
      }

      // --- 5. Hero Overall Completion Score & Dynamic Headline ---
      const stepScore = Math.min(1, steps / this.goals.steps);
      const waterScore = Math.min(1, water / this.goals.water);
      const calScore = totalCalories > 0 ? Math.min(1, totalCalories / this.goals.calories) : 0;
      const proteinScore = Math.min(1, totalProtein / this.goals.protein);
      const workoutScore = Math.min(1, totalMinutes / this.goals.workoutMinutes);

      const overallPct = Math.round(((stepScore + waterScore + calScore + proteinScore + workoutScore) / 5) * 100);

      this.animateCount('hero-overall-pct', overallPct, 380, (n) => `${Math.round(n)}%`);
      const ring = document.getElementById('hero-overall-ring');
      const circumference = 2 * Math.PI * 66; // r=66 -> ~414.69
      const offset = circumference - (Math.min(100, overallPct) / 100) * circumference;
      ring.style.strokeDashoffset = offset;

      // Dynamic headline based on progress (0%, 1-49%, 50-99%, 100%)
      const greetingEl = document.getElementById('greeting-title');
      const summaryEl = document.getElementById('summary-phrase');
      const ringWrapper = document.getElementById('hero-ring-wrapper');

      if (overallPct === 0) {
        greetingEl.textContent = "Let's get started";
        summaryEl.textContent = "Take your first step, drink a glass of water, or log your breakfast.";
        if (ringWrapper) ringWrapper.classList.remove('ring-celebrate');
      } else if (overallPct < 50) {
        greetingEl.textContent = "Good start";
        summaryEl.textContent = "You're building positive momentum towards today's wellness targets.";
        if (ringWrapper) ringWrapper.classList.remove('ring-celebrate');
      } else if (overallPct < 100) {
        greetingEl.textContent = "Almost there";
        summaryEl.textContent = "Over halfway to your goals! Keep up the cadence and finish strong.";
        if (ringWrapper) ringWrapper.classList.remove('ring-celebrate');
      } else {
        greetingEl.textContent = "Goals crushed 🎉";
        summaryEl.textContent = "Outstanding dedication! You've successfully crushed your daily targets today.";
        if (ringWrapper) ringWrapper.classList.add('ring-celebrate');
      }

      document.getElementById('hero-steps-text').textContent = `${steps.toLocaleString()} / ${this.goals.steps.toLocaleString()}`;
      document.getElementById('hero-water-text').textContent = `${water.toLocaleString()} / ${this.goals.water.toLocaleString()} ml`;
      document.getElementById('hero-cals-text').textContent = `${Math.round(totalCalories).toLocaleString()} / ${this.goals.calories.toLocaleString()} kcal`;
      document.getElementById('hero-protein-text').textContent = `${totalProtein.toFixed(0)} / ${this.goals.protein} g`;

      // --- 6. Energy Balance ---
      const totalBurned = stepKcal + totalWorkoutCalories;
      document.getElementById('net-step-burn').textContent = stepKcal.toLocaleString();
      document.getElementById('net-workout-burn').textContent = totalWorkoutCalories.toLocaleString();
      document.getElementById('net-total-burn').textContent = totalBurned.toLocaleString();
      document.getElementById('net-consumed').textContent = Math.round(totalCalories).toLocaleString();

      const balanceBadge = document.getElementById('net-energy-status');
      const net = Math.round(totalCalories - totalBurned);
      if (Math.abs(net) < 150) {
        balanceBadge.textContent = 'Energy Neutral (±150 kcal)';
        balanceBadge.className = 'net-energy-badge';
      } else if (net > 0) {
        balanceBadge.textContent = `+${net} kcal Surplus`;
        balanceBadge.className = 'net-energy-badge surplus';
      } else {
        balanceBadge.textContent = `${net} kcal Deficit`;
        balanceBadge.className = 'net-energy-badge deficit';
      }
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // ==========================================================================
    // 7-DAY ANALYTICS & CANVAS CHARTS (WITH 7-DAY AVG & INTERACTIVE TOOLTIPS)
    // ==========================================================================
    getLast7DaysData() {
      const days = [];
      const [y, m, d] = this.currentDate.split('-').map(Number);
      const baseDate = new Date(y, m - 1, d);

      for (let i = 6; i >= 0; i--) {
        const target = new Date(baseDate);
        target.setDate(baseDate.getDate() - i);
        const dateKey = this.formatDateKey(target);
        const data = this.getDayData(dateKey);
        const dayLabel = target.toLocaleDateString(undefined, { weekday: 'short' });

        const totalCals = (data.meals || []).reduce((acc, m) => acc + (parseFloat(m.calories) || 0), 0);
        const totalProtein = (data.meals || []).reduce((acc, m) => acc + (parseFloat(m.protein) || 0), 0);
        const totalWorkoutMins = (data.workouts || []).reduce((acc, w) => acc + (parseInt(w.duration, 10) || 0), 0);

        days.push({
          dateKey,
          label: dayLabel,
          steps: data.steps || 0,
          water: data.water || 0,
          calories: totalCals,
          protein: totalProtein,
          workoutMinutes: totalWorkoutMins
        });
      }
      return days;
    }

    renderCharts() {
      const days = this.getLast7DaysData();

      // Update Header Averages
      const avgSteps = Math.round(days.reduce((acc, d) => acc + d.steps, 0) / 7);
      const avgWater = Math.round(days.reduce((acc, d) => acc + d.water, 0) / 7);
      const avgCals = Math.round(days.reduce((acc, d) => acc + d.calories, 0) / 7);

      document.getElementById('avg-weekly-steps').textContent = avgSteps.toLocaleString();
      document.getElementById('avg-weekly-water').textContent = `${avgWater.toLocaleString()} ml`;
      document.getElementById('avg-weekly-cals').textContent = `${avgCals.toLocaleString()} kcal`;

      document.getElementById('trend-steps-goal').textContent = this.goals.steps.toLocaleString();
      document.getElementById('trend-water-goal').textContent = `${this.goals.water.toLocaleString()} ml`;

      // Draw Steps Chart
      this.drawBarChart(
        'steps-trend-canvas',
        days.map(d => d.label),
        days.map(d => d.steps),
        this.goals.steps,
        '#10b981',
        '#34d399',
        'steps'
      );

      // Draw Water Chart
      this.drawBarChart(
        'water-trend-canvas',
        days.map(d => d.label),
        days.map(d => d.water),
        this.goals.water,
        '#06b6d4',
        '#38bdf8',
        'ml'
      );

      // Draw Calories Chart
      this.drawBarChart(
        'nutrition-trend-canvas',
        days.map(d => d.label),
        days.map(d => d.calories),
        this.goals.calories,
        '#f59e0b',
        '#fbbf24',
        'kcal'
      );

      // Draw Workout Minutes Chart
      this.drawBarChart(
        'workout-trend-canvas',
        days.map(d => d.label),
        days.map(d => d.workoutMinutes),
        this.goals.workoutMinutes,
        '#f43f5e',
        '#fb7185',
        'mins'
      );
    }

    drawBarChart(canvasId, labels, values, targetLine, colorPrimary, colorGradient, unit = '') {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      const paddingLeft = 38;
      const paddingBottom = 30;
      const paddingTop = 24;
      const paddingRight = 20;

      const chartW = w - paddingLeft - paddingRight;
      const chartH = h - paddingTop - paddingBottom;

      const avgVal = Math.round(values.reduce((a, b) => a + b, 0) / (values.length || 1));
      const maxVal = Math.max(targetLine * 1.25, ...values, avgVal * 1.2, 10);
      const barWidth = Math.floor(chartW / (labels.length * 1.8));
      const stepX = chartW / labels.length;

      // 1. Draw Target Goal Line
      const targetY = paddingTop + chartH - (targetLine / maxVal) * chartH;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(paddingLeft, targetY);
      ctx.lineTo(w - paddingRight, targetY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Goal (${targetLine.toLocaleString()})`, w - paddingRight, targetY - 4);

      // 2. Draw 7-Day Average Reference Line
      const avgY = paddingTop + chartH - (avgVal / maxVal) * chartH;
      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = colorPrimary;
      ctx.lineWidth = 1.2;
      ctx.moveTo(paddingLeft, avgY);
      ctx.lineTo(w - paddingRight, avgY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = colorPrimary;
      ctx.textAlign = 'left';
      ctx.fillText(`7-Day Avg: ${avgVal.toLocaleString()} ${unit}`, paddingLeft + 4, avgY - 4);

      // 3. Draw rounded bars & capture coordinates for tooltips
      const barBoxes = [];
      labels.forEach((label, i) => {
        const val = values[i] || 0;
        const barH = (val / maxVal) * chartH;
        const x = paddingLeft + i * stepX + (stepX - barWidth) / 2;
        const y = paddingTop + chartH - barH;

        barBoxes.push({ x, y, width: barWidth, height: barH, val, label, unit });

        const grad = ctx.createLinearGradient(0, y, 0, paddingTop + chartH);
        grad.addColorStop(0, colorGradient);
        grad.addColorStop(1, colorPrimary);

        ctx.fillStyle = grad;
        const radius = 6;
        ctx.beginPath();
        if (barH > radius) {
          ctx.moveTo(x, y + radius);
          ctx.arcTo(x, y, x + radius, y, radius);
          ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
          ctx.lineTo(x + barWidth, paddingTop + chartH);
          ctx.lineTo(x, paddingTop + chartH);
        } else {
          ctx.rect(x, y, barWidth, Math.max(2, barH));
        }
        ctx.closePath();
        ctx.fill();

        // Value text over bar
        if (val > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px "Outfit", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(Math.round(val).toLocaleString(), x + barWidth / 2, Math.max(paddingTop + 10, y - 5));
        }

        // X Axis Day Label
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + barWidth / 2, h - 8);
      });

      // Tooltip hover handling
      canvas._bars = barBoxes;
      if (!canvas._hasTooltipHandler) {
        canvas._hasTooltipHandler = true;
        const tooltip = document.getElementById('chart-tooltip');
        canvas.addEventListener('mousemove', (e) => {
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const mouseX = (e.clientX - rect.left) * scaleX;

          const hit = (canvas._bars || []).find(b => mouseX >= b.x && mouseX <= b.x + b.width);
          if (hit && tooltip) {
            tooltip.classList.remove('hidden');
            tooltip.innerHTML = `<span style="color:#94a3b8;">${hit.label}:</span> <span style="color:${colorPrimary}; font-weight:800;">${Math.round(hit.val).toLocaleString()} ${hit.unit}</span>`;
            tooltip.style.left = `${e.clientX}px`;
            tooltip.style.top = `${e.clientY}px`;
          } else if (tooltip) {
            tooltip.classList.add('hidden');
          }
        });
        canvas.addEventListener('mouseleave', () => {
          if (tooltip) tooltip.classList.add('hidden');
        });
      }
    }

    // --- Demo Data & Data Reset ---
    seedSampleData() {
      const [y, m, d] = this.currentDate.split('-').map(Number);
      const baseDate = new Date(y, m - 1, d);

      const presets = [
        { steps: 8400, water: 2250, meals: [{ id: 'm1', name: 'Oatmeal & Protein Shake', calories: 480, protein: 35, type: 'Breakfast' }, { id: 'm2', name: 'Chicken Bowl', calories: 650, protein: 48, type: 'Lunch' }], workouts: [{ id: 'w1', type: 'Weight Training', duration: 50, intensity: 'Moderate', calories: 340 }] },
        { steps: 11200, water: 2750, meals: [{ id: 'm1', name: 'Eggs & Avocado Toast', calories: 520, protein: 28, type: 'Breakfast' }, { id: 'm2', name: 'Salmon & Sweet Potato', calories: 720, protein: 45, type: 'Dinner' }], workouts: [{ id: 'w1', type: 'Running', duration: 40, intensity: 'Vigorous', calories: 420 }] },
        { steps: 9800, water: 2500, meals: [{ id: 'm1', name: 'Greek Yogurt Bowl', calories: 380, protein: 30, type: 'Breakfast' }, { id: 'm2', name: 'Steak & Salad', calories: 680, protein: 55, type: 'Dinner' }], workouts: [{ id: 'w1', type: 'HIIT Cardio', duration: 35, intensity: 'Vigorous', calories: 380 }] },
        { steps: 12400, water: 3000, meals: [{ id: 'm1', name: 'Protein Pancakes', calories: 510, protein: 40, type: 'Breakfast' }, { id: 'm2', name: 'Turkey Wrap', calories: 580, protein: 42, type: 'Lunch' }], workouts: [{ id: 'w1', type: 'Cycling', duration: 60, intensity: 'Moderate', calories: 450 }] },
        { steps: 7200, water: 2000, meals: [{ id: 'm1', name: 'Smoothie Bowl', calories: 400, protein: 24, type: 'Breakfast' }, { id: 'm2', name: 'Rice & Tofu Bowl', calories: 590, protein: 32, type: 'Lunch' }], workouts: [{ id: 'w1', type: 'Yoga / Mobility', duration: 45, intensity: 'Light', calories: 150 }] },
        { steps: 10500, water: 2800, meals: [{ id: 'm1', name: 'Scrambled Eggs & Fruit', calories: 450, protein: 25, type: 'Breakfast' }, { id: 'm2', name: 'Chicken Rice Bowl', calories: 710, protein: 50, type: 'Lunch' }], workouts: [{ id: 'w1', type: 'Weight Training', duration: 55, intensity: 'Vigorous', calories: 390 }] },
        { steps: 10250, water: 2500, meals: [{ id: 'm1', name: 'Overnight Oats', calories: 420, protein: 32, type: 'Breakfast' }, { id: 'm2', name: 'Grilled Chicken & Quinoa', calories: 680, protein: 52, type: 'Lunch' }], workouts: [{ id: 'w1', type: 'Running', duration: 35, intensity: 'Moderate', calories: 350 }] }
      ];

      presets.forEach((data, i) => {
        const dt = new Date(baseDate);
        dt.setDate(baseDate.getDate() - (6 - i));
        const key = this.formatDateKey(dt);
        localStorage.setItem(`pulsefit_day_${key}`, JSON.stringify(data));
      });

      this.render();
      this.renderCharts();
      this.sound.playSuccess();
      this.showToast('Demo 7-day fitness history populated!', 'success');
    }

    resetAllData() {
      if (confirm('Are you sure you want to reset all tracked health data and daily records?')) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('pulsefit_')) {
            localStorage.removeItem(key);
          }
        });
        this.loadGoals();
        this.render();
        this.renderCharts();
        this.showToast('All health data reset successfully.');
      }
    }
  }

  // Instantiate Application & Expose globally for inline DOM event triggers
  window.app = new PulseFitApp();

})();
