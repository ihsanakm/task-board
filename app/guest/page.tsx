"use client";

import { BoardLayout } from "../components/Board/BoardLayout";
import styles from './guest.module.css';

export default function GuestPage() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <span className={styles.title}>Guest View (Read-Only)</span>
                <div className={styles.headerActions}>
                    <a href="/login" className={styles.loginLink}>Login as Staff</a>
                </div>
            </header>
            <main className={styles.main}>
                <BoardLayout isGuest={true} />
            </main>
        </div>
    );
}
