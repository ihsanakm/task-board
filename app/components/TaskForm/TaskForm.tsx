import React, { useState, useEffect } from 'react';
import { Task, Priority, Status, User, Project } from '../../types';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import { supabase } from '../../lib/supabaseClient';
import styles from './TaskForm.module.css';

interface TaskFormProps {
    task?: Task; // If present, we are editing
    projects?: Project[]; // List of available projects
    defaultProjectId?: string; // Pre-select a project if creating new
    onSubmit: (taskData: Partial<Task>) => void;
    onCancel: () => void;
    onDelete?: () => void; // Only for edit mode
    isReadOnly?: boolean;
}

export function TaskForm({
    task,
    projects = [],
    defaultProjectId = '',
    onSubmit,
    onCancel,
    onDelete,
    isReadOnly = false
}: TaskFormProps) {
    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [priority, setPriority] = useState<Priority>(task?.priority || 'Medium');
    const [status, setStatus] = useState<Status>(task?.status || 'To Do');
    const [assigneeId, setAssigneeId] = useState(task?.assigneeId || '');
    const [projectId, setProjectId] = useState(task?.projectId || defaultProjectId || '');

    // Check validation on render or just rely on form required? Form required is good.
    const [dueDate, setDueDate] = useState(task?.dueDate || '');
    // Parse attachments robustly
    const rawAttachments = Array.isArray(task?.attachments)
        ? task.attachments
        : (typeof task?.attachments === 'string' && (task.attachments as string).startsWith('[')
            ? (() => { try { return JSON.parse(task.attachments as string); } catch { return []; } })()
            : []);

    const [attachments, setAttachments] = useState<{ name: string; url: string; file?: File; uploadedBy: 'admin' | 'moderator' | 'member' }[]>(
        rawAttachments.map((att: any) => {
            if (typeof att === 'string') {
                if (att.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(att);
                        return {
                            name: parsed.name || 'Attachment',
                            url: parsed.url || att,
                            uploadedBy: parsed.uploadedBy || 'member',
                            type: parsed.type || 'file'
                        } as any;
                    } catch (e) {
                        // Fallback below
                    }
                }
                return { name: att.split('/').pop() || 'Attachment', url: att, uploadedBy: 'member' };
            }
            return att as any;
        })
    );
    const [newFile, setNewFile] = useState('');

    // ... (rest of code)
    const [currentUser, setCurrentUser] = useState<{ id: string, email?: string, role?: string } | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // New Fields
    const [workNote, setWorkNote] = useState('');
    const [markAsDone, setMarkAsDone] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (isReadOnly) {
                setCurrentUser({ id: 'guest', role: 'guest' });
                return;
            }
            setIsLoadingUsers(true);
            try {
                // Fetch current user
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // Fetch current user's role
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', user.id)
                        .single();

                    setCurrentUser({
                        id: user.id,
                        email: user.email,
                        role: profile?.role
                    });
                }

                // Fetch all profiles
                const { data: profiles, error } = await supabase
                    .from('profiles')
                    .select('*');

                if (error) throw error;
                if (profiles) {
                    const mappedUsers: User[] = profiles.map(p => ({
                        id: p.id,
                        name: p.full_name || 'Unnamed User',
                        email: '', // Email not in profiles table usually
                        initials: (p.full_name || 'UN').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
                        role: p.role as any
                    }));
                    setAllUsers(mappedUsers);
                }
            } catch (error) {
                console.error('Error fetching users:', error);
            } finally {
                setIsLoadingUsers(false);
            }
        };

        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Process Note and Status
        let finalDescription = description;
        if (workNote.trim()) {
            const timestamp = new Date().toLocaleString();
            finalDescription += `\n\n--- Update [${timestamp}] ---\n${workNote.trim()}`;
        }

        const finalStatus = markAsDone ? 'Done' : status;

        // Upload Files to Supabase Storage
        const processedAttachments = await Promise.all(attachments.map(async (attachment: any) => {
            if (attachment.file) {
                try {
                    let fileNameToUse = attachment.name;
                    // Failsafe: if name is a stringified JSON object (to prevent double-encoding bugs)
                    if (typeof fileNameToUse === 'string' && fileNameToUse.startsWith('{')) {
                        try {
                            const p = JSON.parse(fileNameToUse);
                            fileNameToUse = p.name || 'document';
                        } catch (e) { }
                    }

                    const sanitizedName = String(fileNameToUse).replace(/[^a-zA-Z0-9.-]/g, '_');
                    const fileName = `private/${Date.now()}-${sanitizedName}`;

                    const { data, error } = await supabase.storage
                        .from('attachments')
                        .upload(fileName, attachment.file);

                    if (error) throw error;

                    const { data: { publicUrl } } = supabase.storage
                        .from('attachments')
                        .getPublicUrl(data.path);

                    return {
                        name: fileNameToUse,
                        url: publicUrl,
                        uploadedBy: attachment.uploadedBy,
                        type: 'file'
                    };
                } catch (err) {
                    console.error('Error uploading file:', err);
                    return attachment;
                }
            }
            return attachment;
        }));

        onSubmit({
            title,
            description: finalDescription,
            priority,
            status: finalStatus,
            assigneeId,
            dueDate,
            projectId,
            attachments: processedAttachments as any,
        });
    };

    const addAttachment = () => {
        if (newFile.trim()) {
            setAttachments([...attachments, {
                name: newFile.trim().split('/').pop() || 'Link',
                url: newFile.trim(),
                uploadedBy: (currentUser?.role as any) || 'member',
                type: 'link'
            } as any]);
            setNewFile('');
        }
    };

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const objectUrl = URL.createObjectURL(file);
            setAttachments([...attachments, {
                name: file.name,
                url: objectUrl,
                file,
                uploadedBy: (currentUser?.role as any) || 'member',
                type: 'file'
            } as any]);
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ... (render) ...



    return (
        <form onSubmit={handleSubmit} className={styles.form}>
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
            />

            <div className={styles.header}>
                <h2>{task ? 'Edit Task' : 'Create Task'}</h2>
            </div>

            {/* ... rest of the body ... */}

            <div className={styles.body}>
                {projects.length > 0 && (
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>
                            Project <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                        </label>
                        <select
                            className={styles.select}
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            disabled={isReadOnly || currentUser?.role === 'member'}
                            required
                        >
                            <option value="" disabled>Select a project</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <Input
                    label="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="What needs to be done?"
                    autoFocus
                    disabled={isReadOnly || currentUser?.role === 'member'}
                />

                {/* ... description ... */}

                <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                        {currentUser?.role === 'member' ? 'Task Description & History' : 'Description'}
                    </label>
                    <textarea
                        className={styles.textarea}
                        rows={6}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add more details about the task..."
                        disabled={isReadOnly || currentUser?.role === 'member'}
                    />
                </div>

                {/* Status Update Section - Only for members who can't edit description */}
                {!isReadOnly && currentUser?.role === 'member' && (
                    <div className={styles.fieldGroup} style={{ marginTop: '1rem', padding: '1rem', background: 'hsl(var(--neutral-50))', borderRadius: 'var(--radius-md)', border: '1px dashed hsl(var(--border-default))' }}>
                        <label className={styles.label} style={{ color: 'hsl(var(--color-primary))' }}>
                            Add Status Update / Note
                        </label>
                        <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '0.5rem' }}>
                            Your note will be appended to the Task Description above with a timestamp.
                        </p>
                        <textarea
                            className={styles.textarea}
                            rows={2}
                            value={workNote}
                            onChange={(e) => setWorkNote(e.target.value)}
                            placeholder="What did you work on? (e.g., 'Started the design mockups')"
                        />
                    </div>
                )}

                <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Priority</label>
                        <select
                            className={styles.select}
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as Priority)}
                            disabled={isReadOnly || currentUser?.role === 'member'}
                        >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Status</label>
                        <select
                            className={styles.select}
                            value={status}
                            onChange={(e) => setStatus(e.target.value as Status)}
                            disabled={isReadOnly || currentUser?.role === 'member'}
                        >
                            <option value="To Do">To Do</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Review">Review</option>
                            <option value="Done">Done</option>
                        </select>
                    </div>
                </div>

                <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Assignee</label>
                        <select
                            className={styles.select}
                            value={assigneeId}
                            onChange={(e) => setAssigneeId(e.target.value)}
                            disabled={isReadOnly || currentUser?.role === 'member'}
                        >
                            <option value="">Unassigned</option>
                            {allUsers.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.name} {u.id === currentUser?.id ? '(Me)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Due Date</label>
                        <Input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            disabled={isReadOnly || currentUser?.role === 'member'}
                        />
                    </div>
                </div>

                {status !== 'Done' && !isReadOnly && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input
                            type="checkbox"
                            checked={markAsDone}
                            onChange={(e) => setMarkAsDone(e.target.checked)}
                            id="markAsDone"
                            style={{ width: '1rem', height: '1rem' }}
                        />
                        <label htmlFor="markAsDone" className={styles.label} style={{ cursor: 'pointer' }}>
                            Mark task as Completed (Done)
                        </label>
                    </div>
                )}

                {/* Attachments Section */}
                <div className={styles.fieldGroup}>
                    <label className={styles.label}>Attachments {isReadOnly && attachments.length === 0 && '(None)'}</label>
                    {!isReadOnly && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => fileInputRef.current?.click()}
                                title="Upload from device"
                            >
                                📂 Upload
                            </Button>
                            <div style={{ flex: 1 }}>
                                <Input
                                    placeholder="Or enter file URL..."
                                    value={newFile}
                                    onChange={e => setNewFile(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addAttachment();
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {attachments.length > 0 && (
                        <div className={styles.attachmentList}>
                            {attachments.map((attachment: any, idx) => {
                                // Robust parsing for different data formats
                                let finalAtt: { name: string; url: string; uploadedBy?: string; type?: string } = { name: 'Unnamed', url: '' };

                                if (typeof attachment === 'string') {
                                    if (attachment.startsWith('{')) {
                                        try {
                                            finalAtt = JSON.parse(attachment);
                                        } catch (e) {
                                            finalAtt = { name: 'Unknown JSON', url: '' };
                                        }
                                    } else {
                                        // Legacy: attachment is just a path or URL string
                                        const parts = attachment.split('/');
                                        const name = parts[parts.length - 1] || 'Legacy File';
                                        finalAtt = { name, url: attachment };
                                    }
                                } else {
                                    finalAtt = {
                                        name: attachment.name || 'Unnamed',
                                        url: attachment.url || '',
                                        uploadedBy: attachment.uploadedBy,
                                        type: attachment.type
                                    };
                                }

                                // Ensure URL is absolute. If it's a relative path, resolve it to Supabase Storage
                                let fileUrl = finalAtt.url;

                                // Extra check: is the URL itself a stringified JSON? (Handles double-encoding bugs)
                                if (typeof fileUrl === 'string' && fileUrl.startsWith('{')) {
                                    try {
                                        const inner = JSON.parse(fileUrl);
                                        if (inner.url) fileUrl = inner.url;
                                    } catch (e) { }
                                }

                                if (fileUrl && !fileUrl.startsWith('http') && !fileUrl.startsWith('blob:') && !fileUrl.startsWith('data:')) {
                                    // It's a raw storage path - construct the public URL using the globally configured URL
                                    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                                    if (baseUrl) {
                                        // Ensure no double slashes when joining
                                        const cleanPath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
                                        fileUrl = `${baseUrl}/storage/v1/object/public/attachments/${cleanPath}`;
                                    }
                                }

                                const isUrl = fileUrl?.startsWith('http');
                                const isBlob = fileUrl?.startsWith('blob:');
                                const displayName = finalAtt.name;

                                // Final check: if the name is JSON, un-mangle it for display too
                                let cleanName = displayName;
                                if (typeof cleanName === 'string' && cleanName.startsWith('{')) {
                                    try {
                                        const n = JSON.parse(cleanName);
                                        cleanName = n.name || 'File';
                                    } catch (e) { }
                                }

                                const isAdmin = currentUser?.role === 'admin';
                                const isModerator = currentUser?.role === 'moderator';
                                const canDelete = !isReadOnly && (isAdmin || isModerator || (finalAtt.uploadedBy !== 'admin'));

                                return (
                                    <div key={idx} className={styles.attachmentCard}>
                                        <div className={styles.fileIcon}>
                                            📄
                                        </div>
                                        <div className={styles.fileInfo}>
                                            {isReadOnly ? (
                                                <span className={styles.fileName}>{cleanName}</span>
                                            ) : (
                                                <a
                                                    href={fileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className={styles.fileName}
                                                >
                                                    {cleanName}
                                                </a>
                                            )}
                                            <span className={styles.fileType}>
                                                {isBlob ? 'Local File' : (isUrl ? 'Cloud Storage' : 'Link')}
                                                {finalAtt.uploadedBy && (
                                                    <span style={{ marginLeft: '5px', opacity: 0.6, fontSize: '0.8em' }}>
                                                        By {finalAtt.uploadedBy}
                                                    </span>
                                                )}
                                            </span>
                                        </div>

                                        {canDelete && (
                                            <button
                                                type="button"
                                                onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                                                className={styles.removeBtn}
                                                title="Remove attachment"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>

            <div className={styles.footer}>
                {task && onDelete && !isReadOnly && (currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
                    <Button type="button" variant="danger" onClick={onDelete} style={{ marginRight: 'auto' }}>
                        Delete
                    </Button>
                )}
                <Button type="button" variant="ghost" onClick={onCancel} className={styles.cancelButton}>
                    {isReadOnly ? 'Close' : 'Cancel'}
                </Button>
                {!isReadOnly && (
                    <Button type="submit" variant="primary">
                        {task ? 'Save Changes' : 'Create Task'}
                    </Button>
                )}
            </div>
        </form >
    );
}
