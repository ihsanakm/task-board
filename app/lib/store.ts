import { Project, Task, User, Status } from '../types';

export const INITIAL_USERS: User[] = [
    { id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', initials: 'AJ', role: 'admin' },
    { id: 'u2', name: 'Bob Smith', email: 'bob@example.com', initials: 'BS', role: 'moderator' },
    { id: 'u3', name: 'Charlie Kim', email: 'charlie@example.com', initials: 'CK', role: 'member' },
];

export const INITIAL_COLUMNS: { id: Status; title: string }[] = [
    { id: 'To Do', title: 'To Do' },
    { id: 'In Progress', title: 'In Progress' },
    { id: 'Review', title: 'Review' },
    { id: 'Done', title: 'Done' },
];

const PROJECT_1_TASKS: Task[] = [
    {
        id: 't1',
        title: 'Design Login Page',
        description: 'Create high-fidelity mockups for the login flow including error states.',
        priority: 'High',
        status: 'Done',
        assigneeId: 'u1',
        dueDate: '2025-12-20',
        attachments: ['design-v1.fig', 'requirements.pdf']
    },
    {
        id: 't2',
        title: 'Setup Project Repo',
        description: 'Initialize Next.js app and configure linting rules.',
        priority: 'Medium',
        status: 'Done',
        assigneeId: 'u2',
        dueDate: '2025-12-18',
    },
    {
        id: 't3',
        title: 'Research Database Options',
        description: 'Compare Supabase vs Firebase for our use case.',
        priority: 'Low',
        status: 'Done',
        assigneeId: 'u3',
        dueDate: '2025-12-15',
    },
    {
        id: 't4',
        title: 'Implement Drag and Drop',
        description: 'Use dnd-kit to allow moving tasks between columns.',
        priority: 'High',
        status: 'In Progress',
        assigneeId: 'u1',
        dueDate: '2025-12-25',
    },
    {
        id: 't5',
        title: 'API Integration',
        description: 'Connect frontend forms to Supabase tables.',
        priority: 'High',
        status: 'To Do',
        assigneeId: 'u2',
        dueDate: '2025-12-30',
    },
    {
        id: 't6',
        title: 'Bug: Modal Overlay',
        description: 'Fix the z-index issue on mobile view.',
        priority: 'Medium',
        status: 'Review',
        assigneeId: 'u3',
        dueDate: '2025-12-21',
    }
];

const PROJECT_2_TASKS: Task[] = [
    {
        id: 'p2-t1',
        title: 'Marketing Campaign',
        description: 'Plan Q1 marketing strategy.',
        priority: 'High',
        status: 'In Progress',
        assigneeId: 'u1',
        dueDate: '2026-01-15',
    },
    {
        id: 'p2-t2',
        title: 'Social Media Assets',
        description: 'Create banner images for Twitter and LinkedIn.',
        priority: 'Medium',
        status: 'To Do',
        assigneeId: 'u3',
        dueDate: '2026-01-10',
    },
    {
        id: 'p2-t3',
        title: 'SEO Audit',
        description: 'Identify keywords for the landing page.',
        priority: 'Low',
        status: 'Done',
        assigneeId: 'u2',
        dueDate: '2025-12-10',
    }
];

export const MOCK_PROJECTS: Project[] = [
    {
        id: 'p1',
        name: 'Task Board MVP',
        columns: INITIAL_COLUMNS,
        tasks: PROJECT_1_TASKS,
    },
    {
        id: 'p2',
        name: 'Marketing Q1',
        columns: INITIAL_COLUMNS,
        tasks: PROJECT_2_TASKS,
    },
];

// Fallback for parts of the app that expect a single project default
export const MOCK_PROJECT = MOCK_PROJECTS[0];
