// 关卡与练习文本（英文打字 · 传统 QWERTY 英文键盘 · 渐进难度）
// 每个关卡都内置「课前小课堂」教材：material.goal（学什么）/ material.tip（怎么打）/ material.example（示范）
// focus：本关重点练习的按键，会在教材页的键盘上高亮（null 表示不单独高亮）
// 设计思路（合理关卡递进）：
//   1-3 关  指法基础（回家键行 / 上行 / 下行，先小写）
//   4-5 关  词与句（建立语感）
//   6 关    大写字母（Shift + 字母）
//   7 关    数字
//   8 关    符号与标点
//   9 关    大小写混合（真实句子）
//   10 关   文章练习（内置多篇，随机抽取）
//   11 关   随机综合练习（🎲 单词/句子/数字/符号/文章混合）
// 带 random: true 的关卡为“随机练习”，每次抽取不同文本。
const LESSONS = [
  {
    id: 'l1',
    title: '第 1 关 · 回家键行',
    desc: 'Home Row：a s d f g h j k l ;（手指的"家"，g、h 是食指延伸）',
    material: {
      goal: '认识键盘的「回家键」：中间那一排 a s d f g h j k l ;。平时手指就放在这里，像回家一样，所以叫回家键。g 在 f 的右边、h 在 j 的左边，它们是食指向两边轻轻一伸就能碰到的“延伸键”，也属于回家键这一排。把手指放稳，这一关就成功了一半！',
      tip: '左手四指：小指 a、无名指 s、中指 d、食指 f；食指再向右伸一点点就够到 g。右手四指：食指 j、中指 k、无名指 l、小指 ; ；食指再向左伸一点点就够到 h。打 g 或 h 时，食指轻轻向旁边伸一下，打完立刻回到 f 或 j 这个“家”。',
      example: 'asdfg hjkl;',
    },
    focus: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
    texts: [
      'asdfg hjkl; asdfg hjkl;',
      'fgh jkl; asdfg',
      'has had gas fad',
      'glad flag half glass',
      'hag gash flash slash',
    ],
  },
  {
    id: 'l2',
    title: '第 2 关 · 上行键',
    desc: '上排：q w e r t y u i o p',
    material: {
      goal: '认识键盘上面一排字母：q w e r t y u i o p。它们都在回家键的正上方。',
      tip: '打上行键时，手指从回家键“伸上去”按一下，马上回到回家键。左手食指够 r、t；右手食指够 y、u。记住：伸出去，就回来。',
      example: 'qwerty uiop',
    },
    focus: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    texts: [
      'qwer tyui op qwer',
      'quiet water power',
      'try the quiet type',
      'we require quiet tire',
      'pretty queen wrote paper',
    ],
  },
  {
    id: 'l3',
    title: '第 3 关 · 下行键',
    desc: '下排：z x c v b n m',
    material: {
      goal: '认识键盘下面一排字母：z x c v b n m。它们在回家键的下方。',
      tip: '打下行键时，手指从回家键“向下探”一下再回来。左手食指够 v、b；右手食指够 n、m。和上行键一样：探出去，就回来。',
      example: 'zxcvbnm',
    },
    focus: ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
    texts: [
      'zxcv bnm zxcv',
      'mamba vim zinc',
      'buzz mix vex cab',
      'van zoom next club',
      'maximize bonus comic',
    ],
  },
  {
    id: 'l4',
    title: '第 4 关 · 常用词',
    desc: '常见英文单词（小写）',
    material: {
      goal: '用学过的字母拼出常见英文单词，练习手指的连贯动作。',
      tip: '打单词时眼睛看屏幕，别看键盘。手指快去快回，一个字母接一个字母，保持自己的节奏。可以先慢慢打准，再慢慢加快。',
      example: 'the cat sat',
    },
    focus: null,
    texts: [
      'the cat sat on the mat',
      'i like to play and read',
      'we go to school every day',
      'my dog can run very fast',
      'blue red green yellow black white',
      'happy family kitchen garden window',
    ],
  },
  {
    id: 'l5',
    title: '第 5 关 · 小句子',
    desc: '完整句子（小写）',
    material: {
      goal: '把单词连成完整的句子，注意单词之间的空格。',
      tip: '词与词之间要用大拇指按【空格键】。句子结尾有句号“.”，也要打出来哦。打句子时不要急，一行一行稳稳地打。',
      example: 'the cat sat on the mat.',
    },
    focus: [' '],
    texts: [
      'the quick brown fox jumps over the lazy dog',
      'practice makes perfect when you type every day',
      'happy children love to learn new things at school',
      'a good friend helps you when you need it most',
      'the sun rises in the east and sets in the west',
    ],
  },
  {
    id: 'l6',
    title: '第 6 关 · 大写字母',
    desc: '练习 Shift + 字母（人名、缩写、全大写）',
    material: {
      goal: '学会打大写字母：先按住 Shift 键，再按字母键，两个一起按。',
      tip: '左手区的字母（a～m）用右手小指按右边的 Shift；右手区的字母（n～p、y、u 等）用左手小指按左边的 Shift。练习“Shift + 字母”一起按，手指要记住位置。',
      example: 'THE CAT  (Shift + 字母)',
    },
    focus: null,
    texts: [
      'A B C D E F G H I J K L M',
      'N O P Q R S T U V W X Y Z',
      'THE QUICK BROWN FOX',
      'HELLO WORLD MY NAME IS TOM',
      'USA UK GDP NASA FBI NBA',
      'WE WENT TO THE ZOO IN MAY',
      'I LOVE APPLE GOOGLE AND AMAZON',
    ],
  },
  {
    id: 'l7',
    title: '第 7 关 · 数字',
    desc: '数字 0-9 与常见数字组合',
    material: {
      goal: '认识键盘最上面一排数字键：1 2 3 4 5 6 7 8 9 0。',
      tip: '数字键就在字母键正上方，左右手分工和字母一样（1 用左手小指，0 用右手小指）。打电话、记价格、写房间号都要靠它们，多练到不用看键盘。',
      example: '0123456789',
    },
    focus: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    texts: [
      '0123456789',
      '123 456 7890',
      'the code is 4827',
      'call 555 0199 now',
      'price 9 dollars 99 cents',
      'room 304 floor 12 zip 90210',
      'i have 3 cats and 2 dogs',
      'score from 0 to 100',
    ],
  },
  {
    id: 'l8',
    title: '第 8 关 · 符号与标点',
    desc: '常用标点与符号（含 Shift 符号）',
    material: {
      goal: '学会打常用标点和符号，比如句号、逗号、问号、@、$ 等。',
      tip: '符号大多和数字同在一个键上：不按 Shift 打下面是符号（如 . , /），按住 Shift 打上面是符号（如 ! @ #）。看到需要 Shift 的符号，就先按住 Shift 再按数字键。',
      example: 'hello, world!  ( ? @ # $ )',
    },
    focus: ['.', ',', '!', '?', ';', ':', "'", '"', '@', '#', '$', '%', '(', ')', '[', ']', '+', '='],
    texts: [
      '. , ! ? ; :',
      'hello, world!',
      'what is your name?',
      'she said, "hi there"',
      'a + b = c',
      '100% sure',
      'email me at a@b.com',
      'cost $5 and fee $2',
      'open (close) [box] {key}',
      'use #tag and & sign',
    ],
  },
  {
    id: 'l9',
    title: '第 9 关 · 大小写混合',
    desc: '句子里夹大写（专有名词、句首）',
    material: {
      goal: '在句子里正确使用大写：句首字母、人名、地名都要大写。',
      tip: '看到需要大写的地方，先按 Shift 再按字母。专有名词如 Tom、Paris 首字母大写，其余小写。打句子时一边读一边想：这里要不要大写？',
      example: 'My name is Tom.',
    },
    focus: [' '],
    texts: [
      'My cat is sleeping.',
      'Hello, I am Alex.',
      'The Sun is big and hot.',
      'We visited Paris in July.',
      'John ate 3 Apples and 2 Oranges.',
      "She said, 'Good job, Tim!'",
      'The Fox jumped over the Dog.',
      'Did you read the Book about Mars?',
    ],
  },
  {
    id: 'l10',
    title: '第 10 关 · 文章练习',
    desc: '较长文章（内置多篇，随机抽取）',
    random: true,
    material: {
      goal: '连续打一段完整的文章，锻炼专注力和持续打字的速度。',
      tip: '文章比较长，保持稳定的节奏，不要着急。打错了没关系，光标会继续往前走，你只管接着往下打就好。准备好就出发吧！',
      example: '（每次随机抽一段文章，准备好了就出发！）',
    },
    focus: null,
    texts: [
      'The quick brown fox jumps over the lazy dog. This sentence uses every letter of the alphabet. Practice makes perfect when you type every day.',
      'Once upon a time, a little boy named Tim loved to read books. Every night before bed, his mother told him a story about brave knights and friendly dragons.',
      'The sun was shining and the birds were singing. Children played in the green park while their parents watched with smiles. It was a happy morning.',
      'Water is very important for all living things. People drink water, plants need water, and animals live in water. We must keep our rivers and oceans clean.',
      'A small robot named Bolt could fix anything. One day it repaired a broken clock, then a squeaky door, and finally a sad toy bear that had lost its voice.',
      'Learning to type is like learning to ride a bike. At first it feels strange, but with practice your fingers remember where each key is.',
      'My friend Lucy has a red bicycle. Every Saturday we ride to the lake and watch the ducks swim. Sometimes we bring bread and feed them slowly.',
      'The library is a quiet place full of stories. You can travel to far away lands, meet brave heroes, and learn about stars without leaving your chair.',
    ],
  },
  {
    id: 'l11',
    title: '第 11 关 · 随机综合练习',
    desc: '🎲 随机混合：单词 / 句子 / 数字 / 符号 / 文章',
    random: true,
    material: {
      goal: '综合前面所有内容，随机出题：单词、句子、数字、符号、文章都可能遇到。',
      tip: '这是“终极挑战”。什么都可能出现，沉着应对，把学过的指法都用上！大写按 Shift，数字在上方，符号看清楚要不要 Shift。放松打，你能行！',
      example: '（随机综合，每次都不一样）',
    },
    focus: null,
    texts: [
      'the quick brown fox jumps over the lazy dog',
      'MY NAME IS TOM AND I LIKE 3 CATS',
      'call 555 0199 or email a@b.com now',
      'The Sun is big. We visited Paris in July!',
      'price $9 and fee $2 total 100% sure',
      'she said, "hello world" and typed a + b = c',
      'Once upon a time a little boy named Tim loved to read books every night.',
      'open (close) [box] {key} use #tag and & sign',
      'i have 12 apples, 8 bananas and 3 oranges',
      'NASA launched a rocket to Mars in 2024.',
      'The Fox jumped over the Dog near the Zoo.',
      'type 4827 then press enter to submit the form',
    ],
  },
];
