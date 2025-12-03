export const API_URL = "http://localhost:5000";

export interface TodoForm {
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  importance: "high" | "normal" | "low";
  completed: boolean;
  completed_at?: string;
  user_id?: number; // Required for linking todos to a user
}

export interface Todo extends TodoForm {
  id: number;
  created_at: string;
}

// ---------------- TODOS ---------------- //

/**
 * Fetch todos for a specific user
 * @param user_id - User ID from localStorage
 */
export const fetchTodos = async (user_id: number): Promise<Todo[]> => {
  const res = await fetch(`${API_URL}/todos/${user_id}`);
  if (!res.ok) throw new Error("Failed to fetch todos");
  return res.json();
};

/**
 * Create a new todo
 */
export const createTodo = async (todo: TodoForm): Promise<Todo> => {
  if (!todo.user_id) throw new Error("User ID is required to create todo");

  const res = await fetch(`${API_URL}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(todo),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to create todo");
  }

  return res.json();
};

/**
 * Update an existing todo
 */
export const updateTodo = async (id: number, todo: TodoForm): Promise<Todo> => {
  const res = await fetch(`${API_URL}/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(todo),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update todo: ${text}`);
  }

  return res.json();
};

/**
 * Delete a todo by ID
 */
export const deleteTodo = async (id: number): Promise<void> => {
  const res = await fetch(`${API_URL}/todos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete todo");
};
// ---------------- NOTES ---------------- //
export interface NoteForm {
  title: string;
  content: string;
  user_id?: number;
}

export interface Note extends NoteForm {
  id: number;
  created_at: string;
  updated_at: string;
}

export const fetchNotes = async (user_id: number): Promise<Note[]> => {
  const res = await fetch(`${API_URL}/notes/${user_id}`);
  if (!res.ok) throw new Error("Failed to fetch notes");
  return res.json();
};

export const createNote = async (note: NoteForm): Promise<Note> => {
  const res = await fetch(`${API_URL}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  });
  if (!res.ok) throw new Error("Failed to create note");
  return res.json();
};

export const updateNote = async (id: number, note: NoteForm): Promise<Note> => {
  const res = await fetch(`${API_URL}/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  });
  if (!res.ok) throw new Error("Failed to update note");
  return res.json();
};

export const deleteNote = async (id: number): Promise<void> => {
  const res = await fetch(`${API_URL}/notes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete note");
};
