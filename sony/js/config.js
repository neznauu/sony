/* ══════════════════════════════════════════
   CONFIG — тексты, данные, настройки
   Меняйте здесь всё, что относится к содержанию.
   ══════════════════════════════════════════ */

const CONFIG = {

  /* Быстрый проход: вступление пропущено,
     все листы уже получены, открыт финал. */
  DEV_UNLOCK_ALL: false,

  STORAGE_KEY: 'sony_starlight_journey_v1',

  /* ── Фоновая музыка ──────────────────── */
  BACKGROUND_MUSIC: 'assets/background.mp3',
  BACKGROUND_MUSIC_VOLUME: 0.16,

  /* ── Вступление ───────────────────────── */
  INTRO_LINES: [
    'Это история, рассказанная звёздами.',
    'Каждая звезда — это момент.',
    'Нажми на звезду, чтобы прожить его.'
  ],

  /* ── Титры ────────────────────────────── */
  LEVEL_TITLES: ['Знакомство', 'Сближение', 'Ссоры'],
  FINAL_TITLE: 'Финал',
  FINAL_CAPTION: '',

  /* ── Темп ─────────────────────────────── */
  SHEET_MIN_READ_SECONDS: 5,
  SLIDE_SECONDS: 5,

  /* ── Листы ────────────────────────────── */
  /* Текст уже на самом изображении листа. */
  SHEET_IMAGES: [
    'assets/sheets/1.jpg',
    'assets/sheets/2.jpg',
    'assets/sheets/3.jpg'
  ],

  /* ── Викторина ────────────────────────── */
  QUIZ: [
    {
      bg: 'assets/quiz/1.jpg',
      question: 'Кто первый написал?',
      options: ['Тима', 'Соня', 'ХЗ', ':)'],
      correct: 0
    },
    {
      bg: 'assets/quiz/2.jpg',
      question: 'Кто первый признался?',
      options: ['Тима', 'Соня', 'ХЗ', ':)'],
      correct: 1
    },
    {
      bg: 'assets/quiz/3.jpg',
      question: 'Любиимый мультик Сони?',
      options: ['ГравитиФолз', 'Рик и Морти', 'СпанчБоб', 'Наруто'],
      correct: 3
    },
    {
      bg: 'assets/quiz/4.jpg',
      question: 'Благодоря Соне Тима узнал что Маша ... Алишера? ?',
      options: ['Ненавидит', 'Любит', 'Уважает', 'Проклянает'],
      correct: 1
    },
    {
      bg: 'assets/quiz/5.jpg',
      question: 'Угадай?',
      options: ['какашка', 'связь', '67', 'любовь'],
      correct: 2
    }
  ],

  /* ── Слайдшоу ─────────────────────────── */
  SLIDES: [
    { src: 'assets/slides/1.png', caption: '' },
    { src: 'assets/slides/2.png', caption: '' },
    { src: 'assets/slides/3.png', caption: '' },
    { src: 'assets/slides/4.png', caption: '' },
    { src: 'assets/slides/5.png', caption: '' },
    { src: 'assets/slides/6.png', caption: '' }
  ],

  /* ── Персонажи ──────────── */
  HERO_IMG: 'assets/characters/him.jpg',
  HIM_IMG: 'assets/characters/hero.jpg',

  /* ── Карта ────────────────────────────── */
  /* Замкнутый контур 0→1→2→3→0 без
     самопересечений. Четвёртая звезда выше всех. */
  STARS: [
    { x: 22, y: 71 },
    { x: 78, y: 57 },
    { x: 63, y: 31 },
    { x: 36, y: 12 }
  ]
};
