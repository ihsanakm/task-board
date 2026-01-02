"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './lib/supabaseClient';
import { BoardLayout } from "./components/Board/BoardLayout";
import styles from './page.module.css';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserRole = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (data) setUserRole(data.role);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        router.push('/login');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (!session) {
    return null; // Or a loading spinner
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.title}>Simple Task Board</span>
        <div className={styles.headerActions}>
          {(userRole === 'admin' || userRole === 'moderator') && (
            <a href="/admin" className={styles.adminLink}>Admin View</a>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            className={styles.signOutButton}
          >
            Sign Out
          </button>
          <div className={styles.userAvatar}>
            {session.user.email?.[0].toUpperCase()}
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <BoardLayout />
      </main>
    </div>
  );
}
