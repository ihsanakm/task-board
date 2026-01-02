import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar } from 'lucide-react';
import clsx from 'clsx';
import styles from './TaskCard.module.css';
import { Task, User } from '../../types';
import { Badge } from '../Badge/Badge';
import { Avatar } from '../Avatar/Avatar';

interface TaskCardProps {
    task: Task;
    onClick?: () => void;
    users: User[];
}

export function TaskCard({ task, onClick, users }: TaskCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id, data: { type: 'Task', task } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const assignee = users.find((u) => u.id === task.assigneeId);

    const getPriorityVariant = (p: string) => {
        switch (p) {
            case 'High': return 'danger';
            case 'Medium': return 'warning';
            case 'Low': return 'success'; // or neutral
            default: return 'neutral';
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(styles.card, isDragging && styles.dragging)}
            onClick={onClick}
            {...attributes}
            {...listeners}
        >
            <div className={styles.header}>
                <span className={styles.title}>{task.title}</span>
                {/* Helper to visually debug priority logic if needed, but Badge is better */}
            </div>

            <div className={styles.description}>{task.description}</div>

            <div className={styles.footer}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Badge variant={getPriorityVariant(task.priority) as any}>
                        {task.priority}
                    </Badge>
                    {task.dueDate && (
                        <div className={styles.dueDate}>
                            <Calendar size={12} />
                            <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    {task.attachments && task.attachments.length > 0 && (
                        <div style={{ color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px' }}>
                            <span style={{ fontSize: '12px' }}>📎</span>
                            <span style={{ fontWeight: 600 }}>{task.attachments.length}</span>
                        </div>
                    )}
                    {assignee && (
                        <Avatar
                            size="sm"
                            fallback={assignee.initials}
                            title={assignee.name}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
