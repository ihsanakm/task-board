"use client";

import React, { useState, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus, ChevronDown } from 'lucide-react';
import styles from './BoardLayout.module.css';
import { Column } from './Column';
import { TaskCard } from './TaskCard';
import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';
import { TaskForm } from '../TaskForm/TaskForm';
import { supabase } from '../../lib/supabaseClient';
import { Task, Status, Project, User, DbTask, DbProject, DbProfile } from '../../types';

interface BoardLayoutProps {
    isGuest?: boolean;
}

export function BoardLayout({ isGuest = false }: BoardLayoutProps) {
    // Initialize projects from MOCK, but keep in state to allow additions
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string>('');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [activeId, setActiveId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
    const [currentUser, setCurrentUser] = useState<{ id: string, email?: string, role?: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const currentProject = projects.find(p => p.id === currentProjectId) || (projects[0] ?? { id: '', name: 'No Project', columns: [], tasks: [] });
    const columns = currentProject.columns || [];

    // Sync tasks when project changes
    const handleProjectChange = (projectId: string) => {
        setCurrentProjectId(projectId);
        const proj = projects.find(p => p.id === projectId);
        if (proj) {
            setTasks(proj.tasks);
        }
    };

    const handleCreateProject = async () => {
        const name = window.prompt("Enter new project name:");
        if (name && name.trim()) {
            const newProject = {
                id: crypto.randomUUID(),
                name: name.trim(),
                description: '',
                columns: [
                    { id: 'To Do' as Status, title: 'To Do' },
                    { id: 'In Progress' as Status, title: 'In Progress' },
                    { id: 'Review' as Status, title: 'Review' },
                    { id: 'Done' as Status, title: 'Done' },
                ],
                tasks: [] // Empty start
            };
            // Insert into Supabase
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return; // Should not happen if guarded

            // Exclude 'tasks' from insert payload as it is a relation, but keep 'columns'
            const { tasks: _, ...projectData } = newProject;

            const { data, error } = await supabase.from('projects').insert([{
                ...projectData,
                owner_id: user.id
            }]).select(); // Add select() to return the inserted data
            if (error) {
                console.error('Error creating project', error);
            } else {
                const insertedProject = (data as Project[])[0];
                const updatedProjects = [...projects, insertedProject];
                setProjects(updatedProjects);
                setCurrentProjectId(insertedProject.id);
                setTasks([]);
            }
            setIsDropdownOpen(false);
        }
    };


    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 } // Avoid accidental drags on click
        }),
        useSensor(TouchSensor, {
            // Touch delay allows the user to scroll horizontally without accidentally picking up a card
            activationConstraint: { delay: 250, tolerance: 5 }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id as string);
    }

    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveTask = active.data.current?.type === 'Task';
        const isOverTask = over.data.current?.type === 'Task';
        const isOverColumn = columns.some(col => col.id === overId);

        if (!isActiveTask) return;

        // Restriction: Only Admin/Moderator can move tasks between columns (status change)
        const canMoveStatus = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

        // Dropping a Task over another Task
        if (isActiveTask && isOverTask) {
            setTasks((tasks) => {
                const activeIndex = tasks.findIndex((t) => t.id === activeId);
                const overIndex = tasks.findIndex((t) => t.id === overId);

                // If statuses are different, it's a column move -> Check permission
                if (tasks[activeIndex].status !== tasks[overIndex].status) {
                    if (!canMoveStatus) return tasks; // Deny move

                    const newTasks = [...tasks];
                    newTasks[activeIndex].status = tasks[overIndex].status;
                    return arrayMove(newTasks, activeIndex, overIndex);
                }

                // Same column reordering is allowed for everyone (or restricting that too? Assumed allowed for now)
                return arrayMove(tasks, activeIndex, overIndex);
            });
        }

        // Dropping a Task over a Column (Always a status change)
        if (isActiveTask && isOverColumn) {
            if (!canMoveStatus) return; // Deny move

            setTasks((tasks) => {
                const activeIndex = tasks.findIndex((t) => t.id === activeId);
                const newStatus = overId as Status;

                if (tasks[activeIndex].status !== newStatus) {
                    const newTasks = [...tasks];
                    newTasks[activeIndex].status = newStatus;
                    return arrayMove(newTasks, activeIndex, activeIndex);
                }
                return tasks;
            });
        }
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (active && over) {
            const taskId = active.id as string;
            const task = tasks.find(t => t.id === taskId);

            if (task) {
                // Update Supabase with the new status (the status was already updated in handleDragOver)
                const { error } = await supabase
                    .from('tasks')
                    .update({ status: task.status })
                    .eq('id', taskId);

                if (error) {
                    console.error('Error persisting task status:', error.message);
                } else {
                    // Also update the projects master state to keep everything in sync
                    setProjects(prev => prev.map(p => ({
                        ...p,
                        tasks: p.tasks.map(t => t.id === taskId ? { ...t, status: task.status } : t)
                    })));
                }
            }
        }

        setActiveId(null);
    }

    const activeTask = tasks.find(t => t.id === activeId);

    // -- Modal Logic --
    const handleCreateTask = () => {
        setEditingTask(undefined);
        setIsModalOpen(true);
    };

    const handleEditTask = (task: Task) => {
        setEditingTask(task);
        setIsModalOpen(true);
    };

    const handleSaveTask = async (taskData: Partial<Task>) => {
        if (editingTask) {
            // Update existing task in Supabase
            const updates = {
                title: taskData.title,
                description: taskData.description,
                priority: taskData.priority,
                status: taskData.status,
                assignee_id: taskData.assigneeId || null,
                due_date: taskData.dueDate || null,
                attachments: (taskData.attachments || []).map(att => typeof att === 'object' ? JSON.stringify(att) : att),
                project_id: taskData.projectId
            };
            const { error } = await supabase.from('tasks').update(updates).eq('id', editingTask.id);
            if (error) {
                console.error('Error updating task', error.message);
                alert(`Failed to update task: ${error.message}`);
            } else {
                const updatedTask = { ...editingTask, ...taskData } as Task;

                // Update local tasks state
                setTasks(prev => {
                    const mapped = prev.map(t => t.id === editingTask.id ? updatedTask : t);
                    if (taskData.projectId && taskData.projectId !== currentProjectId) {
                        return mapped.filter(t => t.id !== editingTask.id);
                    }
                    return mapped;
                });

                // Update master projects state to prevent stale data on project switch
                setProjects(prev => prev.map(p => ({
                    ...p,
                    tasks: p.id === updatedTask.projectId
                        ? (p.tasks.some(t => t.id === updatedTask.id)
                            ? p.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
                            : [...p.tasks, updatedTask])
                        : p.tasks.filter(t => t.id !== updatedTask.id)
                })));
            }
        } else {
            // Create new task structure
            const dbTask = {
                id: crypto.randomUUID(),
                title: taskData.title || 'Untitled',
                description: taskData.description || '',
                priority: taskData.priority || 'Medium',
                status: taskData.status || 'To Do',
                assignee_id: taskData.assigneeId || null,
                due_date: taskData.dueDate || null,
                attachments: (taskData.attachments || []).map(att => typeof att === 'object' ? JSON.stringify(att) : att),
                project_id: taskData.projectId || currentProjectId
            };

            const { data, error } = await supabase.from('tasks').insert([dbTask]).select();
            if (error) {
                console.error('Error creating task', error.message);
                alert(`Failed to create task: ${error.message}`);
            } else if (data) {
                const rawTask = data[0] as DbTask;
                const insertedTask: Task = {
                    id: rawTask.id,
                    title: rawTask.title,
                    description: rawTask.description || '',
                    status: rawTask.status,
                    priority: rawTask.priority,
                    assigneeId: rawTask.assignee_id || undefined,
                    dueDate: rawTask.due_date || undefined,
                    projectId: rawTask.project_id,
                    attachments: rawTask.attachments || []
                };

                // Update local tasks state if it belongs to current project
                if (insertedTask.projectId === currentProjectId) {
                    setTasks(prev => [...prev, insertedTask]);
                }

                // Update master projects state
                setProjects(prev => prev.map(p => {
                    if (p.id === insertedTask.projectId) {
                        return { ...p, tasks: [...p.tasks, insertedTask] };
                    }
                    return p;
                }));
            }
        }
        setIsModalOpen(false);
    };

    const handleDeleteTask = () => {
        if (editingTask) {
            setTasks(prev => prev.filter(t => t.id !== editingTask.id));
            setIsModalOpen(false);
        }
    };

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const fetchData = async () => {
            try {
                let user: any = null;
                let role: string | undefined = undefined;

                if (isGuest) {
                    setCurrentUser({ id: 'guest', role: 'guest' });
                    role = 'guest';
                } else {
                    const { data: authData } = await supabase.auth.getUser();
                    user = authData.user;
                    if (!user) {
                        setIsLoading(false);
                        return;
                    }

                    // Fetch Current User Profile
                    const { data: currentUserProfile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', user.id)
                        .single();

                    role = currentUserProfile?.role;
                    setCurrentUser({
                        id: user.id,
                        email: user.email,
                        role: role
                    });
                }

                // Fetch Projects and Tasks separately for better RLS reliability
                const { data: projectData } = await supabase.from('projects').select('*');
                const { data: tasksData } = await supabase.from('tasks').select('*');

                if (projectData) {
                    const projectsList = projectData as DbProject[];
                    let allTasks: Task[] = (tasksData || []).map((t: DbTask) => ({
                        id: t.id,
                        title: t.title,
                        description: t.description || '',
                        status: t.status,
                        priority: t.priority,
                        assigneeId: t.assignee_id || undefined,
                        dueDate: t.due_date || undefined,
                        projectId: t.project_id,
                        attachments: t.attachments || []
                    }));

                    // Member Filter: only show tasks assigned to the member
                    if (role === 'member' && user) {
                        allTasks = allTasks.filter(t => t.assigneeId === user.id);
                    }

                    const mappedProjects: Project[] = projectsList.map(p => ({
                        id: p.id,
                        name: p.name,
                        description: p.description || '',
                        columns: p.columns,
                        tasks: allTasks.filter(t => t.projectId === p.id)
                    }));

                    setProjects(mappedProjects);

                    // Smart Project Selection
                    let initialProject = mappedProjects[0];
                    if (!isGuest && user) {
                        const userTaskProject = mappedProjects.find(p => p.tasks.some((t: Task) => t.assigneeId === user.id));
                        initialProject = userTaskProject || mappedProjects[0];
                    }

                    if (initialProject) {
                        setCurrentProjectId(initialProject.id);
                        setTasks(initialProject.tasks);
                    }
                }

                // Fetch Profiles for Assignees
                const { data: profileData, error: profileError } = await supabase.from('profiles').select('*');
                if (profileError) {
                    console.error('Error fetching profiles', profileError.message);
                } else if (profileData) {
                    const mappedUsers: User[] = (profileData as DbProfile[]).map(p => ({
                        id: p.id,
                        name: p.full_name || 'Unnamed User',
                        email: p.email || '',
                        initials: (p.full_name || 'UN').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
                        role: p.role || 'member'
                    }));
                    setUsers(mappedUsers);
                }
            } catch (err) {
                console.error('Error in BoardLayout fetchData:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [isGuest]);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Close dropdown when clicking outside (simple version)
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isDropdownOpen && !(e.target as Element).closest(`.${styles.dropdownWrapper}`)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    const handleSelectProject = (projectId: string) => {
        handleProjectChange(projectId);
        setIsDropdownOpen(false);
    };

    if (!isMounted) return null;

    if (isLoading) {
        return <div className={styles.loadingContainer}>Loading Task Board...</div>;
    }

    if (projects.length === 0) {
        return (
            <div className={styles.emptyState}>
                <h2>No Projects Accessible</h2>
                <p>It seems you don't have access to any projects or your role has been restricted.</p>
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <Button variant="secondary" onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>
                        Sign Out
                    </Button>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
                        <Button onClick={() => window.location.href = '/admin'}>
                            Go to Admin Panel
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className={styles.header}>
                <div className={styles.projectSelector}>
                    <span className={styles.projectLabel}>Project</span>
                    <div className={styles.dropdownWrapper}>
                        <button
                            className={`${styles.dropdownTrigger} ${isDropdownOpen ? styles.dropdownTriggerActive : ''}`}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            {currentProject.name}
                            <ChevronDown size={18} />
                        </button>

                        {isDropdownOpen && (
                            <div className={styles.dropdownMenu}>
                                {projects.map(p => (
                                    <div
                                        key={p.id}
                                        className={`${styles.dropdownItem} ${p.id === currentProjectId ? styles.dropdownItemActive : ''}`}
                                        onClick={() => handleSelectProject(p.id)}
                                    >
                                        {p.name}
                                        {p.id === currentProjectId && <span className={styles.checkIcon}>✓</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Navigation buttons removed as per request - managed via top header */}
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                autoScroll={{
                    threshold: {
                        x: 0.1, // Start scrolling when within 10% of the edge
                        y: 0.1,
                    },
                    acceleration: 10,
                }}
            >
                <div className={styles.boardContainer}>
                    {columns.map((col) => (
                        <Column
                            key={col.id}
                            column={col}
                            tasks={tasks.filter((t) => t.status === col.id)}
                            onTaskClick={handleEditTask}
                            users={users}
                        />
                    ))}
                </div>

                <DragOverlay>
                    {activeId && activeTask ? (
                        <TaskCard task={activeTask} users={users} />
                    ) : null}
                </DragOverlay>

            </DndContext>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <TaskForm
                    task={editingTask}
                    projects={projects}
                    defaultProjectId={currentProjectId}
                    onSubmit={handleSaveTask}
                    onCancel={() => setIsModalOpen(false)}
                    onDelete={editingTask ? handleDeleteTask : undefined}
                    isReadOnly={isGuest}
                />
            </Modal>
        </div>
    );
}
