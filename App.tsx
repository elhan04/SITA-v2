
import React, { useState, useEffect } from 'react';
import { User, Role, Student, TahfidzRecord, Attendance, Exam } from './types';
import { MOCK_USERS, MOCK_STUDENTS, MOCK_RECORDS, MOCK_ATTENDANCE, MOCK_EXAMS, LOGO_URL, GOOGLE_SCRIPT_URL } from './constants';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TahfidzLog from './components/TahfidzLog';
import AttendanceView from './components/Attendance';
import ExamView from './components/ExamView';
import AdminPanel from './components/AdminPanel';
import ReportsView from './components/ReportsView';
import ProfileSettings from './components/ProfileSettings';
import TutorialGuide from './components/TutorialGuide';
import { User as UserIcon, Lock, AlertCircle, ArrowRight, CheckCircle2, XCircle, Loader2, WifiOff, Database } from 'lucide-react';
import { api } from './api';

// --- Login Screen ---
const LoginScreen = ({ onLogin, users, students, isLoadingData, connectionError }: { onLogin: (user: User) => void, users: User[], students: Student[], isLoadingData: boolean, connectionError: string | null }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Allow login even if loading, utilizing local data fallback
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user);
      return;
    } 
    
    const student = students.find(s => s.username === username && s.password === password);
    if (student) {
        const studentUser: User = {
            id: student.id,
            name: student.name,
            role: 'parent',
            childId: student.id,
            username: student.username
        };
        onLogin(studentUser);
        return;
    }

    setError('Username atau password salah.');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 relative bg-gray-50 rounded-full p-2">
             <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Darul Abror IBS</h1>
          <p className="text-emerald-600 font-medium text-sm mt-1">Sistem Informasi Tahfidz</p>
        </div>
        
        {/* Connection Error Banner */}
        {connectionError && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                <WifiOff className="text-orange-500 shrink-0 mt-0.5" size={20} />
                <div>
                    <h3 className="font-bold text-orange-700 text-sm">Mode Offline</h3>
                    <p className="text-xs text-orange-600 mt-1 leading-relaxed">
                        {connectionError === 'no_url' 
                            ? "Aplikasi berjalan di penyimpanan lokal. Data tidak akan disinkronkan ke server." 
                            : "Gagal mengambil data terbaru dari server. Menggunakan data terakhir yang tersimpan."}
                    </p>
                </div>
            </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username / NIS</label>
                <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Username atau NIS Santri"
                    required
                />
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Masukkan password"
                    required
                />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
                </div>
            )}

            <button
                type="submit"
                disabled={isLoadingData && !users.length}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
            >
                {isLoadingData ? (
                    <>
                        <Loader2 size={20} className="animate-spin" /> Sedang Memuat...
                    </>
                ) : (
                    <>
                        Masuk Sistem <ArrowRight size={20} />
                    </>
                )}
            </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-400 font-medium">© Copyright 2025. Sistem Informasi Tahfidz Darul Abror IBS V.1</p>
        </div>
      </div>
    </div>
  );
};

// --- Action Result ---
const ActionResult = ({ action, teacherName }: { action: string, teacherName: string }) => {
    const isApproved = action === 'approve';
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100 text-center">
                 <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${isApproved ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                     {isApproved ? <CheckCircle2 size={40} /> : <XCircle size={40} />}
                 </div>
                 <h2 className="text-xl font-bold text-gray-800 mb-2">{isApproved ? 'Izin Disetujui' : 'Izin Ditolak'}</h2>
                 <p className="text-gray-500 mb-6">Pengajuan izin atas nama <strong>{teacherName}</strong> telah berhasil {isApproved ? 'disetujui' : 'ditolak'} oleh sistem.</p>
                 <button onClick={() => window.location.href = window.location.pathname} className="w-full bg-gray-800 text-white py-3 rounded-xl font-medium">Kembali ke Halaman Login</button>
            </div>
        </div>
    );
};

// --- Storage Helper ---
const useStickyState = <T,>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    const stickyValue = window.localStorage.getItem(key);
    return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
};

// --- MAIN APP ---
const App: React.FC = () => {
  // --- SESSION PERSISTENCE (FITUR ANTI-LOGOUT SAAT REFRESH) ---
  // Using 'sita_' prefix for versioning to reset state to "beginning"
  const [user, setUser] = useState<User | null>(() => {
      // Restore user from localStorage if available
      const savedUser = window.localStorage.getItem('sita_current_user_v1');
      return savedUser ? JSON.parse(savedUser) : null;
  });

  const [activeTab, setActiveTab] = useState(() => {
      // Restore active tab
      return window.localStorage.getItem('sita_active_tab_v1') || 'dashboard';
  });

  // Save session changes
  useEffect(() => {
    if (user) {
        window.localStorage.setItem('sita_current_user_v1', JSON.stringify(user));
    } else {
        window.localStorage.removeItem('sita_current_user_v1');
    }
  }, [user]);

  useEffect(() => {
    window.localStorage.setItem('sita_active_tab_v1', activeTab);
  }, [activeTab]);
  
  // Data State - Resetting keys to sita_..._v1 to ensure clean state
  const [users, setUsers] = useStickyState<User[]>(MOCK_USERS, 'sita_users_v1');
  const [students, setStudents] = useStickyState<Student[]>(MOCK_STUDENTS, 'sita_students_v1');
  const [records, setRecords] = useStickyState<TahfidzRecord[]>(MOCK_RECORDS, 'sita_records_v1');
  const [attendance, setAttendance] = useStickyState<Attendance[]>(MOCK_ATTENDANCE, 'sita_attendance_v1');
  const [exams, setExams] = useStickyState<Exam[]>(MOCK_EXAMS, 'sita_exams_v1');

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [urlAction, setUrlAction] = useState<{ type: string, name: string } | null>(null);

  // --- 1. SINKRONISASI DATA (LOAD DARI SHEETS) ---
  useEffect(() => {
     const fetchData = async () => {
        if (!GOOGLE_SCRIPT_URL) {
            setConnectionError('no_url');
            return;
        }
        
        setIsLoadingData(true);
        setConnectionError(null);

        const data = await api.load();
        
        if (data) {
           // Update state dengan data terbaru dari cloud
           if(data.users && data.users.length > 0) setUsers(data.users);
           if(data.students) setStudents(data.students);
           if(data.records) setRecords(data.records);
           if(data.attendance) setAttendance(data.attendance);
           if(data.exams) setExams(data.exams);
        } else {
            // Jika data null padahal URL ada, berarti fetch gagal (biasanya CORS/Permission atau Timeout)
            setConnectionError('fetch_failed');
        }
        setIsLoadingData(false);
     };

     // Only fetch if we have a user (or initial load) but mostly we want to fetch on mount
     fetchData();
  }, []);

  // --- 2. URL ACTIONS (MAGIC LINK) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const id = params.get('id');
    const name = params.get('name');

    if (action && id && name) {
        api.send('markAttendance', { id, approvalStatus: action === 'approve' ? 'approved' : 'rejected' });
        setUrlAction({ type: action, name: decodeURIComponent(name) });
    }
  }, []);

  // --- HANDLERS ---
  const handleAddRecord = (newRecord: TahfidzRecord) => {
    setRecords([newRecord, ...records]);
    api.send('addRecord', newRecord);
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm('Hapus data ini?')) {
      setRecords(records.filter(r => r.id !== id));
      api.send('deleteData', { id, sheetName: 'Records' }); // Added Delete Support
    }
  };

  const handleMarkAttendance = (newAtt: Attendance) => {
    const exists = attendance.findIndex(a => 
      a.userId === newAtt.userId && a.date === newAtt.date && a.type === newAtt.type && a.session === newAtt.session
    );
    if (exists >= 0) {
      const updated = [...attendance];
      updated[exists] = newAtt;
      setAttendance(updated);
    } else {
      setAttendance([...attendance, newAtt]);
    }
    api.send('markAttendance', newAtt);
  };

  const handleAddExam = (newExam: Exam) => {
    setExams([newExam, ...exams]);
    api.send('addExam', newExam);
  };

  // --- Admin Handlers ---
  const handleAddUser = (newUser: User) => {
    setUsers([...users, newUser]);
    api.send('addUser', newUser);
  };

  const handleDeleteUser = (id: string) => {
    if(confirm("Hapus user ini?")) {
        setUsers(users.filter(u => u.id !== id));
        api.send('deleteData', { id, sheetName: 'Users' });
    }
  };

  const handleAddStudent = (newStudent: Student) => {
    setStudents([...students, newStudent]);
    api.send('addStudent', newStudent);
  };

  const handleDeleteStudent = (id: string) => {
    if(confirm("Hapus santri ini?")) {
        setStudents(students.filter(s => s.id !== id));
        api.send('deleteData', { id, sheetName: 'Students' });
    }
  };

  const handleDeleteExam = (id: string) => {
    if(confirm("Hapus data ujian?")) {
        setExams(exams.filter(e => e.id !== id));
        api.send('deleteData', { id, sheetName: 'Exams' });
    }
  };

  const handleUpdateUser = (updatedData: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    
    if (user.role === 'parent' && user.childId === user.id) {
       const studentIdx = students.findIndex(s => s.id === user.id);
       if (studentIdx >= 0) {
           const updatedStudents = [...students];
           updatedStudents[studentIdx] = { ...updatedStudents[studentIdx], ...updatedData };
           setStudents(updatedStudents);
           api.send('updateUser', { ...updatedStudents[studentIdx], role: 'student' });
       }
    } else {
       const userIdx = users.findIndex(u => u.id === user.id);
       if (userIdx >= 0) {
           const updatedUsers = [...users];
           updatedUsers[userIdx] = { ...updatedUsers[userIdx], ...updatedData };
           setUsers(updatedUsers);
           api.send('updateUser', updatedUsers[userIdx]);
       }
    }
  };

  if (urlAction) return <ActionResult action={urlAction.type} teacherName={urlAction.name} />;

  if (!user) return <LoginScreen onLogin={setUser} users={users} students={students} isLoadingData={isLoadingData} connectionError={connectionError} />;

  // --- RENDER CONTENT ---
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': 
        return <Dashboard 
                  user={user} 
                  students={students} 
                  records={records} 
                  exams={exams} 
                  connectionError={connectionError}
                  onNavigate={setActiveTab} // Pass navigation handler
               />;
      
      case 'hafalan': 
        return <TahfidzLog user={user} students={students} records={records} onAddRecord={handleAddRecord} onDeleteRecord={handleDeleteRecord} />;
      
      case 'master_data': 
        return <AdminPanel users={users} students={students} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} onAddStudent={handleAddStudent} onDeleteStudent={handleDeleteStudent} />;
      
      case 'reports': 
        return <ReportsView user={user} students={students} records={records} users={users} attendance={attendance} />;
      
      case 'attendance_student': 
        return <AttendanceView 
                  user={user} 
                  students={students} 
                  users={users} 
                  attendance={attendance} 
                  onMarkAttendance={handleMarkAttendance} 
                  type="student" 
               />;
      
      case 'attendance_teacher': 
      case 'attendance_self': 
        return <AttendanceView 
                  user={user} 
                  students={students} 
                  users={users} 
                  attendance={attendance} 
                  onMarkAttendance={handleMarkAttendance} 
                  type="teacher" 
               />;
      
      case 'exam': 
        return <ExamView user={user} students={students} exams={exams} onAddExam={handleAddExam} onDeleteExam={handleDeleteExam} />;
      
      case 'profile': 
        return <ProfileSettings user={user} onUpdateUser={handleUpdateUser} />;

      // NEW: TUTORIAL ROUTE
      case 'tutorial':
        return <TutorialGuide />;
      
      default: 
        return <Dashboard user={user} students={students} records={records} exams={exams} connectionError={connectionError} />;
    }
  };

  return (
    <Layout user={user} onLogout={() => setUser(null)} activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default App;
