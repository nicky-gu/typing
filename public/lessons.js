// 关卡与练习文本（英文打字 · 传统 QWERTY 英文键盘 · 渐进难度）
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
    desc: 'Home Row：asdf jkl;（左手食指到小指 / 右手食指到小指）',
    texts: [
      'asdf jkl; asdf jkl;',
      'fdsa ;lkj fdsa',
      'sad lad fad flask',
      'all fall jass lass',
      'ask dad; sell salad',
    ],
  },
  {
    id: 'l2',
    title: '第 2 关 · 上行键',
    desc: '上排：q w e r t y u i o p',
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
