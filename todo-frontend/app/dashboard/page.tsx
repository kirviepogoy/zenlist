"use client";

import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import {
  fetchTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  TodoForm,
  Todo,
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  Note,
  NoteForm,
} from "../../utils/api";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";

export default function TodosPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; email: string } | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [form, setForm] = useState<TodoForm>({
    title: "",
    description: "",
    date: "",
    start_time: "",
    end_time: "",
    importance: "normal",
    completed: false,
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedPrevDate, setSelectedPrevDate] = useState<string>("");

  const [notes, setNotes] = useState<Note[]>([]);
  const [noteForm, setNoteForm] = useState<NoteForm>({ title: "", content: "" });
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);

  const quotes = [
    "Stay focused and never give up!",
    "A little progress each day adds up to big results.",
    "Your future is created by what you do today.",
    "Success is the sum of small efforts repeated daily.",
    "Do something today that your future self will thank you for.",
  ];
  const [showQuote, setShowQuote] = useState(true);
  const [randomQuote, setRandomQuote] = useState("");

  useEffect(() => {
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    setRandomQuote(quote);
  }, []);

  const [streak, setStreak] = useState<number | null>(null);
  const [rewardClaimedToday, setRewardClaimedToday] = useState(false);

  // -------------------- Load User --------------------
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    else router.push("/");
  }, []);

  // -------------------- Load Todos & Notes --------------------
  const loadTodos = async () => {
    if (!user) return;
    try {
      const data = await fetchTodos(user.id);
      const sorted = data.sort((a: Todo, b: Todo) => {
        // Use completed_at if completed, otherwise use date/start_time
        const aTime = a.completed_at
          ? new Date(a.completed_at).getTime()
          : new Date(`${a.date}T${a.start_time}`).getTime();
        const bTime = b.completed_at
          ? new Date(b.completed_at).getTime()
          : new Date(`${b.date}T${b.start_time}`).getTime();
        return bTime - aTime; // newest first
      });
      setTodos(sorted);
    } catch (err) {
      console.error(err);
    }
  };

  const loadNotes = async () => {
    if (!user) return;
    try {
      const data = await fetchNotes(user.id);
      const sorted = data.sort((a: Note, b: Note) => b.id - a.id);
      setNotes(sorted);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTodos();
    loadNotes();
  }, [user]);

  // -------------------- Daily Reward Handler --------------------
  const claimDailyReward = async () => {
    if (!user || rewardClaimedToday) return;
    try {
      const res = await fetch(`http://localhost:5000/rewards/daily/${user.id}`, {
        method: "POST",
      });
      const data = await res.json();
      setStreak(data.streak);
      setRewardClaimedToday(true);

      confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
    } catch (err) {
      console.error("Failed to claim reward", err);
    }
  };

  // -------------------- Handlers --------------------
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return alert("No user logged in");

    const todoWithUser: TodoForm = { ...form, user_id: user.id };

    try {
      if ((form as any).id) {
        await updateTodo((form as any).id, todoWithUser);
      } else {
        await createTodo(todoWithUser);
      }

      setForm({
        title: "",
        description: "",
        date: "",
        start_time: "",
        end_time: "",
        importance: "normal",
        completed: false,
      });
      setShowForm(false);
      loadTodos();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (todo: Todo) => {
    setForm({ ...todo });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this task?")) {
      await deleteTodo(id);
      loadTodos();
    }
  };

  const handleDone = async (todo: Todo) => {
    const now = new Date();
    const localDateTime = now.toISOString().slice(0, 19);

    await updateTodo(todo.id, {
      ...todo,
      completed: true,
      completed_at: localDateTime,
    });

    await loadTodos();

    const today = new Date().toISOString().split("T")[0];
    const todayTasks = todos.filter((t) => t.date === today);
    const pendingToday = todayTasks.filter((t) => !t.completed);

    if (pendingToday.length === 0) {
      claimDailyReward();
    }
  };

  // -------------------- Notes Handlers --------------------
  const handleNoteChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNoteForm({ ...noteForm, [e.target.name]: e.target.value });
  };

  const handleNoteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const noteWithUser: NoteForm = { ...noteForm, user_id: user.id };

    try {
      if (editingNoteId) {
        await updateNote(editingNoteId, noteWithUser);
      } else {
        await createNote(noteWithUser);
      }
      setNoteForm({ title: "", content: "" });
      setEditingNoteId(null);
      setShowNoteForm(false);
      loadNotes();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditNote = (note: Note) => {
    setNoteForm({ title: note.title, content: note.content });
    setEditingNoteId(note.id);
    setShowNoteForm(true);
  };

  const handleDeleteNote = async (id: number) => {
    if (confirm("Delete this note?")) {
      await deleteNote(id);
      loadNotes();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/");
  };

  const toggleForm = () => setShowForm(!showForm);
  const toggleNoteForm = () => setShowNoteForm(!showNoteForm);

  // -------------------- Format Helpers --------------------
  const formatDate = (isoDate: string) => {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (time: string) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":").map(Number);
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    return `${h}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${formatDate(d.toISOString().split("T")[0])} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })}`;
  };

  // -------------------- Task Categories --------------------
  const today = new Date().toISOString().split("T")[0];
  const pendingTasks = todos.filter((t) => !t.completed)
    .sort((a, b) => new Date(`${b.date}T${b.start_time}`).getTime() - new Date(`${a.date}T${a.start_time}`).getTime());

  const completedToday = todos.filter(
    (t) => t.completed && t.completed_at?.split("T")[0] === today
  ).sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());

  const previouslyCompleted = todos.filter(
    (t) => t.completed && t.completed_at?.split("T")[0] !== today
  ).sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());

  const prevCompletedDates = Array.from(
    new Set(previouslyCompleted.map((t) => t.completed_at!.split("T")[0]))
  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const filteredPrevCompleted = selectedPrevDate
    ? previouslyCompleted.filter((t) => t.completed_at!.split("T")[0] === selectedPrevDate)
    : [];

  // -------------------- Reward on page load --------------------
  useEffect(() => {
    if (!user) return;
    const todayTasks = todos.filter((t) => t.date === today);
    if (todayTasks.length === 0) return;
    const pendingToday = todayTasks.filter((t) => !t.completed);
    if (pendingToday.length === 0 && !rewardClaimedToday) claimDailyReward();
  }, [todos, user]);

  // -------------------- Rendering --------------------
  return (
    <div className="max-w-7xl mx-auto p-6 font-sans relative">
      
      {/* ---------------- QUOTE POPUP ---------------- */}
      {showQuote && (
        <div className="fixed top-10 right-10 bg-white shadow-lg p-5 rounded-lg w-80 z-50 border">
          <p className="text-lg font-semibold text-gray-700">🌟 Daily Motivation</p>
          <p className="mt-2 italic text-gray-600">"{randomQuote}"</p>

          <button
            onClick={() => setShowQuote(false)}
            className="mt-4 bg-gray-800 text-white px-4 py-2 rounded w-full"
          >
            Close
          </button>
        </div>
      )}

      {/* ---------------- Header ---------------- */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">📋 Zenlist</h1>
        {user && (
          <div className="flex items-center gap-4">
            <span className="font-medium">
              Welcome, {user.email} {streak && `(🔥 ${streak}-day streak)`}
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {/* ---------------- TODO FORM ---------------- */}
      {showForm && (
        <div className="todo-form fixed bottom-20 right-6 bg-white p-6 rounded-2xl shadow-2xl w-80 z-50">
  <form onSubmit={handleSubmit}>
    <h2 className="text-xl font-bold mb-4 text-center">
      {(form as any).id ? "Edit Task" : "Add Task"}
    </h2>

    <label className="block mb-3">
      <span className="font-medium text-gray-700">Title</span>
      <input
        name="title"
        value={form.title}
        onChange={handleChange}
        required
        className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </label>

    <label className="block mb-3">
      <span className="font-medium text-gray-700">Description</span>
      <textarea
        name="description"
        value={form.description}
        onChange={handleChange}
        className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </label>

    <label className="block mb-3">
      <span className="font-medium text-gray-700">Date</span>
      <input
        type="date"
        name="date"
        value={form.date}
        onChange={handleChange}
        required
        className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </label>

    <div className="flex gap-2 mb-3">
      <label className="flex-1">
        <span className="font-medium text-gray-700">Start Time</span>
        <input
          type="time"
          name="start_time"
          value={form.start_time}
          onChange={handleChange}
          className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>
      <label className="flex-1">
        <span className="font-medium text-gray-700">End Time</span>
        <input
          type="time"
          name="end_time"
          value={form.end_time}
          onChange={handleChange}
          className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>
    </div>

    <label className="block mb-4">
      <span className="font-medium text-gray-700">Importance</span>
      <select
        name="importance"
        value={form.importance}
        onChange={handleChange}
        className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="high">High</option>
        <option value="normal">Normal</option>
        <option value="low">Low</option>
      </select>
    </label>

    <div className="flex gap-2">
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex-1 hover:bg-blue-700 transition"
      >
        {(form as any).id ? "Update" : "Add"}
      </button>
      <button
        type="button"
        onClick={toggleForm}
        className="bg-gray-300 px-4 py-2 rounded-lg flex-1 hover:bg-gray-400 transition"
      >
        Cancel
      </button>
    </div>
  </form>
</div>
      )}

      {/* ---------------- NOTES FORM ---------------- */}
      {showNoteForm && (
       <div className="note-form fixed bottom-20 left-6 bg-white p-6 rounded-2xl shadow-2xl w-80 z-50">
  <form onSubmit={handleNoteSubmit}>
    <h2 className="text-xl font-bold mb-4 text-center">
      {editingNoteId ? "Edit Note" : "Add Note"}
    </h2>

    <label className="block mb-3">
      <span className="font-medium text-gray-700">Title</span>
      <input
        name="title"
        value={noteForm.title}
        onChange={handleNoteChange}
        required
        className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-400"
      />
    </label>

    <label className="block mb-4">
      <span className="font-medium text-gray-700">Content</span>
      <textarea
        name="content"
        value={noteForm.content}
        onChange={handleNoteChange}
        className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-400"
      />
    </label>

    <div className="flex gap-2">
      <button
        type="submit"
        className="bg-green-600 text-white px-4 py-2 rounded-lg flex-1 hover:bg-green-700 transition"
      >
        {editingNoteId ? "Update Note" : "Add Note"}
      </button>
      <button
        type="button"
        onClick={toggleNoteForm}
        className="bg-gray-300 px-4 py-2 rounded-lg flex-1 hover:bg-gray-400 transition"
      >
        Cancel
      </button>
    </div>
  </form>
</div>
      )}

      {/* ---------------- FLOATING + BUTTONS ---------------- */}
      <button
        onClick={toggleForm}
        className="fixed bottom-6 right-6 bg-blue-600 text-white w-14 h-14 rounded-full text-3xl flex items-center justify-center shadow-lg z-50"
      >
        +
      </button>
      <button
        onClick={toggleNoteForm}
        className="fixed bottom-6 left-6 bg-green-600 text-white w-14 h-14 rounded-full text-3xl flex items-center justify-center shadow-lg z-50"
      >
        📝
      </button>

      {/* ---------------- DASHBOARD ---------------- */}
      <div className="dashboard-grid grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">

        {/* Pending Tasks */}
        <div className="section-box bg-white rounded-xl shadow-md flex flex-col">
          <h2 className="text-xl font-bold text-center mb-4 border-b border-gray-200 pb-2">Pending Tasks</h2>
          <div
            className="overflow-y-auto max-h-[250px] snap-y snap-mandatory scroll-p-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <style>{`::-webkit-scrollbar { display: none; }`}</style>
            {pendingTasks.length === 0 ? (
              <p className="text-gray-400 text-center mt-4">No pending tasks.</p>
            ) : (
              pendingTasks.map((todo) => (
                <div
                  key={todo.id}
                  className="task-card mb-4 bg-white border-l-4 border-yellow-500 rounded-r-xl p-4 shadow hover:shadow-md transition transform hover:-translate-y-1 snap-start"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-lg capitalize">{todo.title}</h3>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${todo.importance === "high"
                          ? "bg-red-100 text-red-700"
                          : todo.importance === "normal"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                    >
                      {todo.importance.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-2 uppercase">{todo.description}</p>
                  <div className="flex gap-2 mb-3 text-xs">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{formatDate(todo.date)}</span>
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                      {formatTime(todo.start_time)} - {formatTime(todo.end_time)}
                    </span>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => handleDone(todo)} className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 transition">✅</button>
                    <button onClick={() => handleEdit(todo)} className="bg-yellow-500 text-white p-2 rounded-full hover:bg-yellow-600 transition">✏️</button>
                    <button onClick={() => handleDelete(todo.id)} className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition">🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Completed Today */}
        <div className="section-box bg-white rounded-xl shadow-md flex flex-col">
          <h2 className="text-xl font-bold text-center mb-4 border-b border-gray-200 pb-2">Completed Today</h2>
          <div
            className="overflow-y-auto max-h-[250px] snap-y snap-mandatory scroll-p-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <style>{`::-webkit-scrollbar { display: none; }`}</style>
            {completedToday.length === 0 ? (
              <p className="text-gray-400 text-center mt-4">None completed today.</p>
            ) : (
              completedToday.map((todo) => (
                <div
                  key={todo.id}
                  className="task-card mb-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl p-4 shadow hover:shadow-md transition transform hover:-translate-y-1 snap-start"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-lg capitalize">{todo.title}</h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Completed</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-2 uppercase">{todo.description}</p>
                  <div className="flex gap-2 mb-2 text-xs">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{formatDate(todo.date)}</span>
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{formatTime(todo.start_time)} - {formatTime(todo.end_time)}</span>
                  </div>
                  <p className="text-xs text-gray-500 italic">Completed at {formatDateTime(todo.completed_at!)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Previously Completed */}
        <div className="section-box bg-white rounded-xl shadow-md flex flex-col">
          <h2 className="text-xl font-bold text-center mb-4 border-b border-gray-200 pb-2">Previously Completed</h2>
          <select
            className="p-2 border rounded mb-4 w-full text-gray-700"
            value={selectedPrevDate}
            onChange={(e) => setSelectedPrevDate(e.target.value)}
          >
            <option value="">Select a date</option>
            {prevCompletedDates.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </select>
          <div
            className="overflow-y-auto max-h-[250px] snap-y snap-mandatory scroll-p-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <style>{`::-webkit-scrollbar { display: none; }`}</style>
            {filteredPrevCompleted.length === 0 ? (
              <p className="text-gray-400 text-center mt-4">Nothing completed previously.</p>
            ) : (
              filteredPrevCompleted.map((todo) => (
                <div
                  key={todo.id}
                  className="task-card mb-4 bg-purple-50 border-l-4 border-purple-500 rounded-r-xl p-4 shadow hover:shadow-md transition transform hover:-translate-y-1 snap-start"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-lg capitalize">{todo.title}</h3>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Completed</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-2 uppercase">{todo.description}</p>
                  <div className="flex gap-2 mb-2 text-xs">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{formatDate(todo.date)}</span>
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{formatTime(todo.start_time)} - {formatTime(todo.end_time)}</span>
                  </div>
                  <p className="text-xs text-gray-500 italic">Completed at {formatDateTime(todo.completed_at!)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---------------- NOTES ---------------- */}
      <div className="notes-section mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {notes.length === 0 ? (
          <p className="text-gray-400 text-center col-span-3">No notes available.</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="note-card bg-yellow-50 border-l-4 border-yellow-400 rounded-xl p-4 shadow hover:shadow-lg transition transform hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <h3 className="font-semibold text-lg mb-2 uppercase">{note.title}</h3>
                <p className="text-gray-700 text-sm capitalize">{note.content}</p>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => handleEditNote(note)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg transition"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg transition"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}