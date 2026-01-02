export type Priority = 'Low' | 'Medium' | 'High';
export type Status = 'To Do' | 'In Progress' | 'Review' | 'Done';

export interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string; // Optional URL or use initials
    initials: string;
    role: 'admin' | 'moderator' | 'member';
}

export interface Attachment {
    name: string;
    url: string;
    type: 'file' | 'link';
    uploadedBy: 'admin' | 'moderator' | 'member';
}

export interface Task {
    id: string;
    title: string;
    description: string;
    priority: Priority;
    status: Status;
    assigneeId?: string;
    dueDate?: string; // ISO String
    projectId?: string;
    attachments?: Attachment[] | string[]; // Backwards compat with strings
}

export interface Column {
    id: Status; // Status is the unique ID for columns in this simple board
    title: string;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    columns: Column[];
    tasks: Task[];
}

export interface Resource {
    fileName: string;
    url: string;
    taskTitle: string;
    taskId: string;
    uploadedBy: string;
    originalAtt: string | Attachment;
}

// Database Interfaces
export interface DbProfile {
    id: string;
    full_name: string | null;
    email: string | null;
    role: 'admin' | 'moderator' | 'member';
}

export interface DbTask {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    status: Status;
    priority: Priority;
    due_date: string | null;
    assignee_id: string | null;
    attachments: string[] | null;
}

export interface DbProject {
    id: string;
    name: string;
    description: string | null;
    columns: Column[];
    owner_id: string;
}
