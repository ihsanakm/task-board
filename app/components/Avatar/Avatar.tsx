import React from 'react';
import clsx from 'clsx';
import styles from './Avatar.module.css';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
    src?: string;
    fallback: string;
    size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ className, src, fallback, size = 'md', ...props }: AvatarProps) {
    return (
        <div className={clsx(styles.avatar, styles[size], className)} {...props}>
            {src ? (
                <img src={src} alt={fallback} className={styles.image} />
            ) : (
                <span>{fallback.slice(0, 2).toUpperCase()}</span>
            )}
        </div>
    );
}
