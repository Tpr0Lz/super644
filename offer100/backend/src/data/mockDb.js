const users = [
  {
    id: 1,
    username: 'admin',
    password: '123456',
    role: 'admin',
    major: 'Computer Science',
    preferenceTags: ['fullstack', 'management']
  },
  {
    id: 2,
    username: 'studentA',
    password: '123456',
    role: 'student',
    major: 'Software Engineering',
    preferenceTags: ['frontend', 'vue']
  },
  {
    id: 3,
    username: 'socialUser',
    password: '123456',
    role: 'social',
    major: 'N/A',
    preferenceTags: ['operations', 'marketing']
  }
];

const jobs = [
  {
    id: 1,
    title: 'Vue Frontend Engineer',
    company: 'TechNova',
    city: 'Shanghai',
    salaryRange: '12k-18k',
    tags: ['vue', 'javascript', 'frontend'],
    description: 'Develop and optimize enterprise SPA applications.',
    publishAt: '2026-03-01'
  },
  {
    id: 2,
    title: 'Node.js Backend Engineer',
    company: 'CloudRiver',
    city: 'Hangzhou',
    salaryRange: '15k-22k',
    tags: ['nodejs', 'express', 'api'],
    description: 'Build scalable backend services and APIs.',
    publishAt: '2026-03-03'
  },
  {
    id: 3,
    title: 'Product Operations Specialist',
    company: 'GrowthLab',
    city: 'Shenzhen',
    salaryRange: '9k-14k',
    tags: ['operations', 'analysis'],
    description: 'Coordinate campaigns and optimize user conversion.',
    publishAt: '2026-03-05'
  }
];

const companies = [
  {
    id: 1,
    name: 'TechNova',
    updates: 'Expanding campus recruitment in East China.'
  },
  {
    id: 2,
    name: 'CloudRiver',
    updates: 'Launching cloud-native engineer hiring plan.'
  }
];

const behaviorLogs = [];

module.exports = {
  users,
  jobs,
  companies,
  behaviorLogs
};
