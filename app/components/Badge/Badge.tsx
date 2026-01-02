import React from 'react';
import clsx from 'clsx';
import styles from './Badge.module.css';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}

export function Badge({ className, variant = 'neutral', children, ...props }: BadgeProps) {
    return (
        <span className={clsx(styles.badge, styles[variant], className)} {...props}>
            {children}
        </span>
    );
}
