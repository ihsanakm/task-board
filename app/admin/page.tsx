"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Card, CardContent } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { Badge } from '../components/Badge/Badge';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, User as UserIcon, Mail, Pencil, CheckCircle, Trash2, FileText, Download, AlertCircle, Calendar, Search, Plus, X, Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './admin.module.css';
import { User, Task, Project, Resource, Attachment } from '../types';
import { Modal } from '../components/Modal/Modal';
import { TaskForm } from '../components/TaskForm/TaskForm';

export default function AdminPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentProjectId, setCurrentProjectId] = useState<string>('all');
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isProjectManagementModalOpen, setIsProjectManagementModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [projectFormName, setProjectFormName] = useState('');
    const [projectFormDescription, setProjectFormDescription] = useState('');
    const [reportRemark, setReportRemark] = useState('');
    const router = useRouter();

    // Task Management State (New)
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

    // Live Data State
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

    const [newUserTrigger, setNewUserTrigger] = useState({ name: '', email: '', password: '', role: 'member' as const });
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState('');
    const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);

    // Fetch Data from Supabase
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Check Authentication and Role
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (!authUser) {
                    router.push('/login');
                    return;
                }

                setCurrentUser({ id: authUser.id, email: authUser.email });

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', authUser.id)
                    .single();

                if (!profile || profile.role === 'member') {
                    console.warn('Unauthorized access attempt to admin page');
                    router.push('/');
                    return;
                }

                // Fetch profiles
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('*');

                if (profilesError) throw profilesError;

                const formattedUsers: User[] = (profilesData || []).map(p => ({
                    id: p.id,
                    name: p.full_name || 'Unnamed User',
                    email: p.email || '',
                    initials: (p.full_name || 'UN').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
                    role: (p.role as User['role']) || 'member'
                }));

                // Fetch projects
                const { data: projectsData, error: projectsError } = await supabase
                    .from('projects')
                    .select('*');

                if (projectsError) throw projectsError;

                // Fetch tasks
                const { data: tasksData, error: tasksError } = await supabase
                    .from('tasks')
                    .select('*');

                if (tasksError) throw tasksError;

                const formattedTasks: Task[] = (tasksData || []).map(t => ({
                    id: t.id,
                    title: t.title,
                    description: t.description || '',
                    status: (t.status as Task['status']) || 'To Do',
                    priority: (t.priority as Task['priority']) || 'Medium',
                    dueDate: t.due_date,
                    assigneeId: t.assignee_id,
                    projectId: t.project_id,
                    attachments: t.attachments || []
                }));

                setUsers(formattedUsers);
                setProjects(projectsData || []);
                setTasks(formattedTasks);
            } catch (error) {
                console.error('Error fetching admin data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [router]);

    // Filtered Data
    const filteredTasks = useMemo(() => {
        if (currentProjectId === 'all') return tasks;
        return tasks.filter(t => (t as any).project_id === currentProjectId);
    }, [tasks, currentProjectId]);

    const totalTasks = filteredTasks.length;
    const doneTasks = filteredTasks.filter(t => t.status === 'Done').length;
    const activeUsersCount = users.length;
    const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // Overdue Tasks Logic
    const today = new Date();
    const overdueTasks = filteredTasks.filter(t => {
        if (!t.dueDate || t.status === 'Done') return false;
        return new Date(t.dueDate) < today;
    });

    // Individual Progress Logic
    const assigneeProgress = useMemo(() => {
        return users.map(user => {
            const userTasks = filteredTasks.filter(t => t.assigneeId === user.id);
            const userDone = userTasks.filter(t => t.status === 'Done').length;
            const percent = userTasks.length > 0 ? Math.round((userDone / userTasks.length) * 100) : 0;
            return {
                ...user,
                total: userTasks.length,
                done: userDone,
                percent
            };
        }).filter(ap => ap.total > 0);
    }, [users, filteredTasks]);

    // Resource Logic
    const allResources: Resource[] = filteredTasks.flatMap(t =>
        (t.attachments || []).map(att => {
            let finalAtt: string | Attachment = att;
            // Robust parsing for stringified JSON from DB
            if (typeof att === 'string' && att.startsWith('{')) {
                try {
                    finalAtt = JSON.parse(att);
                } catch (e) { }
            }

            const fileName = (typeof finalAtt === 'string') ? finalAtt.split('/').pop() || finalAtt : finalAtt.name;
            const url = (typeof finalAtt === 'string') ? finalAtt : finalAtt.url;
            const uploadedBy = (typeof finalAtt === 'string') ? 'Admin' : (finalAtt.uploadedBy || 'User');

            return {
                fileName,
                url,
                taskTitle: t.title,
                taskId: t.id,
                uploadedBy,
                originalAtt: att
            };
        })
    );

    const filteredResources = allResources.filter(r =>
        r.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.taskTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handlers
    const handleDeleteResource = async (resource: Resource) => {
        if (!confirm(`Are you sure you want to delete "${resource.fileName}"? This will remove it from the task "${resource.taskTitle}".`)) return;

        try {
            // 1. Delete from Supabase Storage if it's a storage URL
            if (resource.url.includes('/storage/v1/object/public/attachments/')) {
                const storagePath = resource.url.split('/attachments/').pop();
                if (storagePath) {
                    const { error: storageError } = await supabase.storage
                        .from('attachments')
                        .remove([storagePath]);
                    if (storageError) {
                        console.warn('Storage delete warning:', storageError.message);
                    }
                }
            }

            // 2. Remove from Task in DB
            const targetTask = tasks.find(t => t.id === resource.taskId);
            if (!targetTask) return;

            const updatedAttachments = (targetTask.attachments || []).filter(att => att !== resource.originalAtt);

            const { error: dbError } = await supabase
                .from('tasks')
                .update({ attachments: updatedAttachments })
                .eq('id', resource.taskId);

            if (dbError) throw dbError;

            // 3. Update local state
            setTasks(tasks.map(t => t.id === resource.taskId ? { ...t, attachments: updatedAttachments as any } : t));
            alert('File deleted successfully.');
        } catch (error: any) {
            console.error('Error deleting resource:', error);
            alert(`Failed to delete resource: ${error.message}`);
        }
    };
    const handleUpdateName = async (userId: string) => {
        if (!editingNameValue.trim()) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: editingNameValue })
                .eq('id', userId);

            if (error) throw error;

            setUsers(users.map(u => u.id === userId ? { ...u, name: editingNameValue } : u));
            setEditingNameId(null);
        } catch (error) {
            console.error('Error updating name:', error);
            alert('Failed to update user name.');
        }
    };

    const handleUpdateRole = async (userId: string, newRole: User['role']) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            console.error('Error updating role:', error);
            alert('Failed to update user role.');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to remove this user profile? This dashboard only removes the profile record, not the Auth account.')) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            setUsers(users.filter(u => u.id !== userId));
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user profile. They might have dependent data (tasks/projects).');
        }
    };

    const handleSaveTask = async (taskData: Partial<Task>) => {
        try {
            let error;
            if (editingTask) {
                // Update
                const { error: updateError } = await supabase
                    .from('tasks')
                    .update({
                        title: taskData.title,
                        description: taskData.description,
                        priority: taskData.priority,
                        status: taskData.status,
                        assignee_id: taskData.assigneeId || null,
                        due_date: taskData.dueDate || null,
                        attachments: (taskData.attachments || []).map(att => typeof att === 'object' ? JSON.stringify(att) : att),
                        project_id: taskData.projectId // Allow updating project
                    })
                    .eq('id', editingTask.id);
                error = updateError;

                if (!error) {
                    setTasks(tasks.map(t => t.id === editingTask.id ? { ...editingTask, ...taskData } as Task : t));
                }
            } else {
                // Create
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // If projectId is passed from form, use it. Otherwise fallback to current filter if specific.
                const finalProjectId = taskData.projectId || (currentProjectId === 'all' ? projects[0]?.id : currentProjectId);

                if (!finalProjectId) {
                    alert('Please select specific project filter or create a project first to add tasks.');
                    return;
                }

                const { data, error: createError } = await supabase
                    .from('tasks')
                    .insert([{
                        title: taskData.title,
                        description: taskData.description,
                        priority: taskData.priority,
                        status: taskData.status,
                        assignee_id: taskData.assigneeId || null,
                        due_date: taskData.dueDate || null, // Convert empty string to null for valid timestamp
                        project_id: finalProjectId,
                        attachments: (taskData.attachments || []).map(att => typeof att === 'object' ? JSON.stringify(att) : att)
                    }])
                    .select();
                error = createError;

                if (data) {
                    const newTask = {
                        id: data[0].id,
                        title: data[0].title,
                        description: data[0].description,
                        status: data[0].status,
                        priority: data[0].priority,
                        dueDate: data[0].due_date,
                        assigneeId: data[0].assignee_id,
                        project_id: data[0].project_id,
                        attachments: data[0].attachments || []
                    } as any;
                    setTasks([...tasks, newTask]);
                }
            }

            if (error) throw error;
            setIsTaskModalOpen(false);
            setEditingTask(undefined);
        } catch (error) {
            console.error('Error saving task:', error);
            alert(`Failed to save task: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm('Delete this task?')) return;
        try {
            const { error } = await supabase.from('tasks').delete().eq('id', taskId);
            if (error) throw error;
            setTasks(tasks.filter(t => t.id !== taskId));
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Failed to delete task.');
        }
    }

    const handleDownloadReport = () => {
        const reportContent = [
            `REPORT REMARK: ${reportRemark || 'No remark provided'}`,
            '',
            ['Task Title', 'Status', 'Priority', 'Assignee', 'Due Date'].join(','),
            ...filteredTasks.map(t => {
                const assignee = users.find(u => u.id === t.assigneeId)?.name || 'Unassigned';
                return [t.title, t.status, t.priority, assignee, t.dueDate || 'N/A'].join(',');
            })
        ].join('\n');

        const blob = new Blob([reportContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `progress-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setIsReportModalOpen(false);
        setReportRemark('');
    };

    const handleAddUser = async () => {
        if (!newUserTrigger.name || !newUserTrigger.email || !newUserTrigger.password) {
            alert("Please fill in all fields, including password.");
            return;
        }

        try {
            // 1. Create the real Auth User in Supabase
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: newUserTrigger.email,
                password: newUserTrigger.password,
                options: {
                    data: {
                        full_name: newUserTrigger.name,
                    }
                }
            });

            if (authError) {
                console.error('Auth Creation Error:', authError.message);
                alert(`Failed to create account: ${authError.message}`);
                return;
            }

            if (!authData.user) {
                alert("Account created, but check your email for confirmation (if enabled in Supabase).");
                setIsUserModalOpen(false);
                return;
            }

            // 2. The profile is usually created by a database trigger (as we set up in SQL earlier).
            // However, for immediate UI update, we construct the object:
            const newUser: User = {
                id: authData.user.id,
                name: newUserTrigger.name,
                email: newUserTrigger.email,
                initials: (newUserTrigger.name || 'UN').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
                role: newUserTrigger.role || 'member'
            };

            setUsers(prev => [...prev, newUser]);
            setIsUserModalOpen(false);
            setNewUserTrigger({ name: '', email: '', password: '', role: 'member' });
            alert("User created successfully!");
        } catch (error) {
            console.error('Error in handleAddUser:', error);
            alert("An unexpected error occurred.");
        }
    };

    const handleSaveProject = async () => {
        if (!projectFormName.trim()) return;

        try {
            if (editingProject) {
                // Update
                const { error } = await supabase
                    .from('projects')
                    .update({
                        name: projectFormName,
                        description: projectFormDescription
                    })
                    .eq('id', editingProject.id);

                if (error) throw error;
                setProjects(projects.map(p => p.id === editingProject.id ? { ...p, name: projectFormName, description: projectFormDescription } : p));
            } else {
                // Create
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Not authenticated');

                const { data, error } = await supabase
                    .from('projects')
                    .insert([{
                        name: projectFormName,
                        description: projectFormDescription,
                        owner_id: user.id,
                        columns: [
                            { id: 'To Do', title: 'To Do' },
                            { id: 'In Progress', title: 'In Progress' },
                            { id: 'Review', title: 'Review' },
                            { id: 'Done', title: 'Done' }
                        ]
                    }])
                    .select();

                if (error) throw error;
                if (data) setProjects([...projects, data[0]]);
            }
            setIsProjectManagementModalOpen(false);
            setEditingProject(null);
            setProjectFormName('');
            setProjectFormDescription('');
        } catch (error) {
            console.error('Error saving project:', error);
            alert('Failed to save project.');
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('Are you sure you want to delete this project? This will delete all associated tasks.')) return;

        try {
            // First delete tasks (foreign key constraint might prevent project deletion if tasks exist)
            const { error: tasksError } = await supabase
                .from('tasks')
                .delete()
                .eq('project_id', projectId);

            if (tasksError) throw tasksError;

            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId);

            if (error) throw error;

            setProjects(projects.filter(p => p.id !== projectId));
            setTasks(tasks.filter(t => t.projectId !== projectId));
            if (currentProjectId === projectId) setCurrentProjectId('all');
            alert('Project and its tasks deleted successfully.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error deleting project:', error);
            alert(`Failed to delete project: ${message}. Check if you have the correct RLS policies.`);
        }
    };

    const handleSignOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            router.push('/login');
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Failed to sign out.');
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loadingOverlay}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 className={styles.spinner} size={48} />
                    <p style={{ marginTop: '1rem', color: 'hsl(var(--text-muted))' }}>Loading Dashboard Data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* Admin Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <Link href="/">
                        <Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button>
                    </Link>
                    <div>
                        <h1 className={styles.headerTitle}>Admin Dashboard</h1>
                        {currentUser && (
                            <div className={styles.welcomeText}>
                                <UserIcon size={14} />
                                <span>Welcome back, <strong>{currentUser.email?.split('@')[0] || 'Admin'}</strong></span>
                            </div>
                        )}
                    </div>

                    <select
                        className={styles.projectSelect}
                        value={currentProjectId}
                        onChange={(e) => setCurrentProjectId(e.target.value)}
                        style={{ marginLeft: '1rem' }}
                    >
                        <option value="all">All Projects</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
                <div className={styles.headerRight}>
                    <Button variant="secondary" size="sm" onClick={() => setIsReportModalOpen(true)}>
                        <Download size={14} /> Report
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleSignOut} style={{ color: 'hsl(var(--danger))' }}>
                        <LogOut size={14} /> Sign Out
                    </Button>
                    <div className={styles.avatar}>AD</div>
                </div>
            </header>

            <main className={styles.main}>
                {/* Stats Overview */}
                <section className={styles.statsGrid}>
                    <Card>
                        <CardContent className={styles.statCardContent}>
                            <div className={clsx(styles.iconWrapper, styles.iconBlue)}>
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <p className={styles.statLabel}>Total Tasks</p>
                                <h3 className={styles.statValue}>{totalTasks}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className={styles.statCardContent}>
                            <div className={clsx(styles.iconWrapper, styles.iconGreen)}>
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <p className={styles.statLabel}>Completed</p>
                                <h3 className={styles.statValue}>{doneTasks}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className={styles.statCardContent}>
                            <div className={clsx(styles.iconWrapper, styles.iconPurple)}>
                                <UserIcon size={24} />
                            </div>
                            <div>
                                <p className={styles.statLabel}>Active Users</p>
                                <h3 className={styles.statValue}>{activeUsersCount}</h3>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Progress Tracking */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}><CheckCircle size={18} /> Project Progress</h2>
                    <Card>
                        <CardContent>
                            <div className={styles.progressSection}>
                                <div className={styles.progressBarTitle}>
                                    <span>Overall Completion Status</span>
                                    <span>{progressPercent}%</span>
                                </div>
                                <div className={styles.progressBarContainer}>
                                    <div className={styles.progressBar} style={{ width: `${progressPercent}%` }}></div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <h3 className={styles.sectionTitle} style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '0.75rem' }}>
                                    Assignee Progress
                                </h3>
                                <div className={styles.assigneeProgressGrid}>
                                    {assigneeProgress.length > 0 ? assigneeProgress.map(ap => (
                                        <div key={ap.id} className={styles.assigneeProgressCard}>
                                            <div className={styles.assigneeHeader}>
                                                <span className={styles.assigneeName}>{ap.name}</span>
                                                <span className={styles.assigneeStats}>{ap.done}/{ap.total} Tasks</span>
                                            </div>
                                            <div className={styles.progressBarContainer} style={{ height: '6px' }}>
                                                <div className={styles.progressBar} style={{ width: `${ap.percent}%` }}></div>
                                            </div>
                                        </div>
                                    )) : (
                                        <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: '0.875rem' }}>
                                            No active assignments for this selection.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className={styles.overdueSection}>
                                <h3 className={styles.sectionTitle} style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>
                                    <AlertCircle size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
                                    Overdue Tasks
                                </h3>
                                {overdueTasks.length > 0 ? (
                                    overdueTasks.map(t => {
                                        const assignee = users.find(u => u.id === t.assigneeId);
                                        return (
                                            <div key={t.id} className={styles.overdueItem}>
                                                <div className={styles.overdueInfo}>
                                                    <span className={styles.overdueName}>{assignee?.name || 'Unassigned'}</span>
                                                    <span className={styles.overdueTask}>{t.title}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <span className={styles.overdueTask} style={{ color: 'hsl(var(--danger))' }}>
                                                        <Calendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                                                        {t.dueDate}
                                                    </span>
                                                    <span className={styles.overdueTag}>OVERDUE</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p style={{ fontSize: '0.875rem', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '1rem' }}>
                                        No overdue tasks for this selection.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Resource Management */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}><FileText size={18} /> Uploaded Resources</h2>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                            <input
                                type="text"
                                placeholder="Search files..."
                                className={styles.searchBar}
                                style={{ paddingLeft: '2.5rem' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <Card>
                        <CardContent>
                            <div className={styles.resourceGrid}>
                                {filteredResources.length > 0 ? (
                                    filteredResources.map((res: any, idx: number) => (
                                        <div key={`${res.taskId}-${idx}`} className={styles.resourceCardWrapper}>
                                            <a
                                                href={res.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={styles.resourceCard}
                                            >
                                                <div className={styles.resourceIcon}>
                                                    <FileText size={20} />
                                                </div>
                                                <div className={styles.resourceInfo}>
                                                    <span className={styles.resourceName} title={res.fileName}>{res.fileName}</span>
                                                    <div className={styles.resourceMeta}>
                                                        <span>{res.taskTitle}</span>
                                                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>By {res.uploadedBy}</span>
                                                    </div>
                                                </div>
                                            </a>
                                            <button
                                                className={styles.deleteResourceBtn}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleDeleteResource(res);
                                                }}
                                                title="Delete this resource"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '2rem' }}>
                                        No resources found.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Task Management */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}><CheckCircle size={18} /> Task Management</h2>
                        <Button size="sm" onClick={() => {
                            setEditingTask(undefined);
                            setIsTaskModalOpen(true);
                        }}>
                            <Plus size={16} /> New Task
                        </Button>
                    </div>
                    <Card>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead className={styles.tableHeader}>
                                    <tr>
                                        <th className={styles.th}>Title</th>
                                        <th className={styles.th}>Status</th>
                                        <th className={styles.th}>Assignee</th>
                                        <th className={styles.th}>Project</th>
                                        <th className={styles.th}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTasks.map(task => (
                                        <tr key={task.id} className={styles.tr}>
                                            <td className={styles.td}>{task.title}</td>
                                            <td className={styles.td}><Badge variant={task.status === 'Done' ? 'success' : 'neutral'}>{task.status}</Badge></td>
                                            <td className={styles.td}>{users.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}</td>
                                            <td className={styles.td}>{projects.find(p => p.id === (task as any).project_id)?.name || 'Unknown'}</td>
                                            <td className={styles.td}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <Button variant="ghost" size="icon" onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}>
                                                        <Pencil size={16} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} style={{ color: 'hsl(var(--danger))' }}>
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </section>

                {/* Project Management */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}><FileText size={18} /> Project Management</h2>
                        <Button size="sm" onClick={() => {
                            setEditingProject(null);
                            setProjectFormName('');
                            setProjectFormDescription('');
                            setIsProjectManagementModalOpen(true);
                        }}>
                            <Plus size={16} /> Add Project
                        </Button>
                    </div>
                    <Card>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead className={styles.tableHeader}>
                                    <tr>
                                        <th className={styles.th}>Project Name</th>
                                        <th className={styles.th}>Created At</th>
                                        <th className={styles.th}>Tasks</th>
                                        <th className={styles.th}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projects.map((project) => {
                                        const projectTasksCount = tasks.filter(t => (t as any).project_id === project.id).length;
                                        return (
                                            <tr key={project.id} className={styles.tr}>
                                                <td className={styles.td}>
                                                    <div style={{ fontWeight: 500 }}>{project.name}</div>
                                                </td>
                                                <td className={clsx(styles.td, styles.tdMuted)}>
                                                    {(project as any).created_at ? new Date((project as any).created_at).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className={styles.td}>
                                                    <Badge variant="neutral">{projectTasksCount} Tasks</Badge>
                                                </td>
                                                <td className={styles.td}>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                setEditingProject(project);
                                                                setProjectFormName(project.name);
                                                                setProjectFormDescription(project.description || '');
                                                                setIsProjectManagementModalOpen(true);
                                                            }}
                                                        >
                                                            <Pencil size={16} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteProject(project.id)}
                                                            style={{ color: 'hsl(var(--danger))' }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </section>

                {/* User Management */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}><UserIcon size={18} /> User Management</h2>
                        <Button size="sm" onClick={() => setIsUserModalOpen(true)}>
                            <Plus size={16} /> Add User
                        </Button>
                    </div>
                    <Card>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead className={styles.tableHeader}>
                                    <tr>
                                        <th className={styles.th}>User</th>
                                        <th className={styles.th}>Email</th>
                                        <th className={styles.th}>Role</th>
                                        <th className={styles.th}>Status</th>
                                        <th className={styles.th}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className={styles.tr}>
                                            <td className={styles.td}>
                                                {editingNameId === user.id ? (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <input
                                                            className={styles.formInput}
                                                            style={{ padding: '0.25rem 0.5rem', width: 'auto' }}
                                                            value={editingNameValue}
                                                            onChange={(e) => setEditingNameValue(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <Button size="sm" onClick={() => handleUpdateName(user.id)}>Save</Button>
                                                        <Button variant="ghost" size="sm" onClick={() => setEditingNameId(null)}>Cancel</Button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {user.name}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            style={{ height: '24px', width: '24px' }}
                                                            onClick={() => {
                                                                setEditingNameId(user.id);
                                                                setEditingNameValue(user.name);
                                                            }}
                                                        >
                                                            <Pencil size={12} />
                                                        </Button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className={styles.td}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'hsl(var(--text-muted))' }}>
                                                    <Mail size={14} />
                                                    <span>{user.email || 'No email'}</span>
                                                </div>
                                            </td>
                                            <td className={styles.td}>
                                                <select
                                                    className={styles.roleSelect}
                                                    value={user.role}
                                                    onChange={(e) => handleUpdateRole(user.id, e.target.value as any)}
                                                >
                                                    <option value="member">Member</option>
                                                    <option value="moderator">Moderator</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </td>
                                            <td className={styles.td}>
                                                <Badge variant="success">Active</Badge>
                                            </td>
                                            <td className={styles.td}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    style={{ color: 'hsl(var(--danger))' }}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </section>
            </main>

            {/* Modals */}
            {isUserModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Add New User</h2>
                            <Button variant="ghost" size="icon" onClick={() => setIsUserModalOpen(false)}>
                                <X size={20} />
                            </Button>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Full Name</label>
                            <input
                                className={styles.formInput}
                                value={newUserTrigger.name}
                                onChange={(e) => setNewUserTrigger({ ...newUserTrigger, name: e.target.value })}
                                placeholder="Enter name"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Email Address</label>
                            <input
                                className={styles.formInput}
                                value={newUserTrigger.email}
                                onChange={(e) => setNewUserTrigger({ ...newUserTrigger, email: e.target.value })}
                                placeholder="Enter email"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Initial Password</label>
                            <input
                                className={styles.formInput}
                                type="password"
                                value={newUserTrigger.password}
                                onChange={(e) => setNewUserTrigger({ ...newUserTrigger, password: e.target.value })}
                                placeholder="Min 6 characters"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Role</label>
                            <select
                                className={styles.formInput}
                                value={newUserTrigger.role}
                                onChange={(e) => setNewUserTrigger({ ...newUserTrigger, role: e.target.value as any })}
                            >
                                <option value="member">Member</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div className={styles.modalFooter}>
                            <Button variant="secondary" onClick={() => setIsUserModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddUser}>Create User</Button>
                        </div>
                    </div>
                </div>
            )}

            {isProjectManagementModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>
                                {editingProject ? 'Edit Project Details' : 'Create New Project'}
                            </h2>
                            <Button variant="ghost" size="icon" onClick={() => setIsProjectManagementModalOpen(false)}>
                                <X size={20} />
                            </Button>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Project Name</label>
                            <input
                                className={styles.formInput}
                                value={projectFormName}
                                onChange={(e) => setProjectFormName(e.target.value)}
                                placeholder="Enter project name"
                                autoFocus
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Description</label>
                            <textarea
                                className={styles.formInput}
                                value={projectFormDescription}
                                onChange={(e) => setProjectFormDescription(e.target.value)}
                                placeholder="Enter project description"
                                rows={3}
                                style={{ resize: 'none' }}
                            />
                        </div>
                        <div className={styles.modalFooter}>
                            <Button variant="secondary" onClick={() => setIsProjectManagementModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveProject}>
                                {editingProject ? 'Update Project' : 'Create Project'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isReportModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Generate Progress Report</h2>
                            <Button variant="ghost" size="icon" onClick={() => setIsReportModalOpen(false)}>
                                <X size={20} />
                            </Button>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--text-muted))', marginBottom: '1rem' }}>
                            Add a remark or summary to be included at the top of the report.
                        </p>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Moderator Remarks</label>
                            <textarea
                                className={styles.formInput}
                                rows={4}
                                value={reportRemark}
                                onChange={(e) => setReportRemark(e.target.value)}
                                placeholder="Summarize project status, blockers, or next steps..."
                                style={{ resize: 'none' }}
                            />
                        </div>
                        <div className={styles.modalFooter}>
                            <Button variant="secondary" onClick={() => setIsReportModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleDownloadReport}>Download CSV</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Form Modal */}
            <Modal
                isOpen={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                title={editingTask ? 'Edit Task' : 'Create New Task'}
            >
                <TaskForm
                    task={editingTask}
                    projects={projects}
                    defaultProjectId={currentProjectId === 'all' ? '' : currentProjectId}
                    onSubmit={handleSaveTask}
                    onCancel={() => setIsTaskModalOpen(false)}
                    onDelete={editingTask ? () => { handleDeleteTask(editingTask.id); setIsTaskModalOpen(false); } : undefined}
                />
            </Modal>
        </div>
    );
}
