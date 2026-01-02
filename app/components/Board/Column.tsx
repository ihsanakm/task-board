import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import clsx from 'clsx';
import styles from './Column.module.css';
import { Column as ColumnType, Task, User } from '../../types';
import { TaskCard } from './TaskCard';

interface ColumnProps {
    column: ColumnType;
    tasks: Task[];
    onTaskClick?: (task: Task) => void;
    users: User[];
}

export function Column({ column, tasks, onTaskClick, users }: ColumnProps) {
    const { setNodeRef } = useDroppable({
        id: column.id,
    });

    const getColumnStyles = (id: string) => {
        switch (id) {
            case 'To Do': return { '--column-bg': 'hsl(var(--col-todo-bg))', '--column-border': 'hsl(var(--col-todo-border))' } as React.CSSProperties;
            case 'In Progress': return { '--column-bg': 'hsl(var(--col-progress-bg))', '--column-border': 'hsl(var(--col-progress-border))' } as React.CSSProperties;
            case 'Review': return { '--column-bg': 'hsl(var(--col-review-bg))', '--column-border': 'hsl(var(--col-review-border))' } as React.CSSProperties;
            case 'Done': return { '--column-bg': 'hsl(var(--col-done-bg))', '--column-border': 'hsl(var(--col-done-border))' } as React.CSSProperties;
            default: return {};
        }
    }

    return (
        <div className={styles.column} style={getColumnStyles(column.id)}>
            <div className={styles.header}>
                <span>{column.title}</span>
                <span className={styles.taskCount}>{tasks.length}</span>
            </div>

            <div ref={setNodeRef} className={styles.taskList}>
                <SortableContext
                    items={tasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {tasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => onTaskClick?.(task)}
                            users={users}
                        />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
}
