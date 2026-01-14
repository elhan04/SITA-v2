
import React, { useState, useEffect } from 'react';
import { User, Student, Exam } from '../types';
import { QURAN_CHAPTERS } from '../constants';
import { Award, Play, ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, XOctagon, CheckCircle2, RotateCcw, Save, Trash2, Maximize2, Minimize2, Sun, Moon, ZoomIn, ZoomOut } from 'lucide-react';

interface ExamViewProps {
  user: User;
  students: Student[];
  exams: Exam[];
  onAddExam: (exam: Exam) => void;
  onDeleteExam?: (id: string) => void;
}

type ViewMode = 'list' | 'setup' | 'live';
type ExamMode = 'halaman' | 'surat';

const ExamView: React.FC<ExamViewProps> = ({ user, students, exams, onAddExam, onDeleteExam }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // Setup State
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [examMode, setExamMode] = useState<ExamMode>('halaman');
  const [startPage, setStartPage] = useState<number>(1);
  const [packetSize, setPacketSize] = useState<number>(10);
  const [selectedSurah, setSelectedSurah] = useState<string>('1');

  // Live Exam State
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [score, setScore] = useState<number>(100);
  const [mistakes, setMistakes] = useState({ dibantu: 0, ditegur: 0, berhenti: 0 });
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  // UI State
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [imageBrightness, setImageBrightness] = useState(100); // 100% default
  const [zoomLevel, setZoomLevel] = useState(1); // 1.0 = 100%

  // --- PERSISTENCE LOGIC (ANTI-RESET SAAT REFRESH) ---
  useEffect(() => {
    // 1. Load Session on Mount
    const savedSession = localStorage.getItem('sita_live_exam_session_v1');
    if (savedSession) {
      try {
        const data = JSON.parse(savedSession);
        // Validasi: Pastikan data sesi masih relevan (misal ID siswa masih ada di daftar)
        const studentExists = students.find(s => s.id === data.currentSession?.student?.id);
        
        if (data.viewMode === 'live' && data.currentSession && studentExists) {
            // Restore State
            setCurrentSession(data.currentSession);
            setCurrentPage(data.currentPage);
            setScore(data.score);
            setMistakes(data.mistakes);
            setExamMode(data.examMode);
            setIsFullScreen(data.isFullScreen);
            setImageBrightness(data.imageBrightness || 100);
            setZoomLevel(data.zoomLevel || 1);
            setViewMode('live');
        } else {
            localStorage.removeItem('sita_live_exam_session_v1');
        }
      } catch (e) {
        console.error("Failed to restore exam session", e);
        localStorage.removeItem('sita_live_exam_session_v1');
      }
    }
  }, [students]);

  useEffect(() => {
    // 2. Save Session on Change
    if (viewMode === 'live' && currentSession) {
      const sessionData = {
        viewMode,
        currentSession,
        currentPage,
        score,
        mistakes,
        examMode,
        isFullScreen,
        imageBrightness,
        zoomLevel
      };
      localStorage.setItem('sita_live_exam_session_v1', JSON.stringify(sessionData));
    } else {
      // Jika user keluar dari mode live (misal ke list), hapus sesi
      if (viewMode === 'list') {
         localStorage.removeItem('sita_live_exam_session_v1');
      }
    }
  }, [viewMode, currentSession, currentPage, score, mistakes, examMode, isFullScreen, imageBrightness, zoomLevel]);

  // PERMISSIONS
  const canStartExam = user.role === 'teacher';
  const canDelete = user.role === 'teacher' || user.role === 'admin';

  const availableClasses = Array.from(new Set(students.map(s => s.class))).sort();
  const availableStudents = students.filter(s => {
    if (selectedClass && s.class !== selectedClass) return false;
    if (user.role === 'teacher') return s.teacherId === user.id;
    return true;
  });

  // --- Handlers ---

  const handleStartExam = () => {
    if (!selectedStudentId) return alert("Pilih santri terlebih dahulu");

    const student = students.find(s => s.id === selectedStudentId);
    let start = 0;
    let end = 0;
    let label = '';

    if (examMode === 'halaman') {
      start = startPage;
      end = Math.min(604, startPage + packetSize - 1);
      label = `Hal ${start} - ${end}`;
    } else {
      const surahIdx = parseInt(selectedSurah);
      const surahData = QURAN_CHAPTERS.find(s => s[0] === surahIdx);
      if (surahData) {
        start = surahData[2];
        end = Math.min(604, start + 2); // Default packet for surah mode logic
        label = `QS. ${surahData[1]}`;
      }
    }

    setCurrentSession({
      student,
      mode: examMode,
      start,
      end,
      label
    });
    setCurrentPage(start);
    setScore(100);
    setMistakes({ dibantu: 0, ditegur: 0, berhenti: 0 });
    setIsFullScreen(false);
    setZoomLevel(1);
    setViewMode('live');
  };

  const handleMistake = (type: 'dibantu' | 'ditegur' | 'berhenti') => {
    const newMistakes = { ...mistakes, [type]: mistakes[type] + 1 };
    setMistakes(newMistakes);
    
    // Formula from prompt
    const penalty = (newMistakes.dibantu * 2) + (newMistakes.ditegur * 1) + (newMistakes.berhenti * 0.5);
    setScore(Math.max(0, 100 - penalty));
  };

  const handleFinishExam = () => {
    if (!confirm("Selesaikan Ujian dan Simpan Nilai?")) return;

    const finalScore = parseFloat(score.toFixed(1));
    const status = finalScore >= 70 ? 'pass' : finalScore >= 50 ? 'remedial' : 'fail';
    
    // Calculate Juz for Metadata
    const juzString = `Juz ${Math.ceil(currentSession.start / 20)}`;

    const newExam: Exam = {
      id: Math.random().toString(36).substr(2, 9),
      studentId: currentSession.student.id,
      date: new Date().toISOString().split('T')[0],
      category: `${currentSession.label}`,
      score: finalScore,
      examiner: user.name,
      status: status === 'remedial' ? 'fail' : status, // Simplified status for internal type
      notes: status.toUpperCase(),
      juz: juzString, // NEW: Top level property for database
      details: {
        juz: juzString,
        surat: examMode === 'surat' ? currentSession.label : `Hal ${currentSession.start}`,
        halaman: `${currentSession.start}-${currentSession.end}`,
        mistakes
      }
    };

    onAddExam(newExam);
    
    // Clear Session
    localStorage.removeItem('sita_live_exam_session_v1');
    setCurrentSession(null);
    setIsFullScreen(false);
    setZoomLevel(1);
    setViewMode('list');
  };

  const handleCancelExam = () => {
    if(confirm("Batalkan Ujian? Progress akan hilang.")) {
        localStorage.removeItem('sita_live_exam_session_v1');
        setViewMode('list');
        setCurrentSession(null);
    }
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3)); // Max 300%
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5)); // Min 50%
  const handleResetZoom = () => {
      setZoomLevel(1);
      setImageBrightness(100);
  };

  // --- Render Sections ---

  const renderSetup = () => (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h3 className="text-xl font-bold text-gray-800">Mulai Ujian Baru</h3>
        <button onClick={() => setViewMode('list')} className="text-gray-500 hover:text-gray-700">
          Batal
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
            <select 
              className="w-full border rounded-lg p-2.5 bg-gray-50"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Semua Kelas</option>
              {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Santri</label>
            <select 
              className="w-full border rounded-lg p-2.5 bg-gray-50"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={availableStudents.length === 0}
            >
              <option value="">-- Pilih Santri --</option>
              {availableStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
            </select>
          </div>
        </div>

        <div className="bg-gray-100 p-1 rounded-lg flex">
          <button 
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${examMode === 'halaman' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
            onClick={() => setExamMode('halaman')}
          >
            Mode Halaman
          </button>
          <button 
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${examMode === 'surat' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
            onClick={() => setExamMode('surat')}
          >
            Mode Surat
          </button>
        </div>

        {examMode === 'halaman' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Halaman Awal (1-604)</label>
              <input 
                type="number" 
                min="1" max="604"
                className="w-full border rounded-lg p-2.5"
                value={startPage}
                onChange={(e) => setStartPage(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paket Soal</label>
              <select 
                className="w-full border rounded-lg p-2.5 bg-gray-50"
                value={packetSize}
                onChange={(e) => setPacketSize(parseInt(e.target.value))}
              >
                <option value={10}>10 Halaman</option>
                <option value={20}>20 Halaman</option>
              </select>
            </div>
          </div>
        ) : (
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Surat</label>
             <select 
                className="w-full border rounded-lg p-2.5 bg-gray-50"
                value={selectedSurah}
                onChange={(e) => setSelectedSurah(e.target.value)}
             >
                {QURAN_CHAPTERS.map(q => (
                  <option key={q[0]} value={q[0]}>{q[0]}. {q[1]} (Hal {q[2]})</option>
                ))}
             </select>
          </div>
        )}

        <button 
          onClick={handleStartExam}
          className="w-full py-3 bg-primary text-white rounded-lg font-bold hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 mt-4"
        >
          MULAI UJIAN <Award size={20} />
        </button>
      </div>
    </div>
  );

  // --- Logic for Header Label (Juz Calculation) ---
  const currentJuz = currentSession ? Math.ceil(currentSession.start / 20) : 0;
  const examLabel = currentSession ? `${currentSession.student.class} | Juz ${currentJuz}, ${currentSession.label}` : '';

  const renderLiveExam = () => {
    const formattedPage = currentPage.toString().padStart(3, '0');
    const imageUrl = `https://android.quran.com/data/width_1024/page${formattedPage}.png`;

    // --- SHARED COMPONENTS ---
    const ScoreBoard = () => (
      <div className="text-right">
        <div className="text-xs text-gray-400 uppercase font-bold">Nilai</div>
        <div className={`text-3xl font-black ${score >= 70 ? 'text-primary' : score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
          {score.toFixed(1)}
        </div>
      </div>
    );

    const ScoringButtons = ({ layout = 'vertical' }: { layout?: 'vertical' | 'horizontal' }) => (
      <div className={`grid ${layout === 'horizontal' ? 'grid-cols-3 gap-4 w-full max-w-xl' : 'grid-cols-3 gap-3'}`}>
        <button 
            onClick={() => handleMistake('dibantu')}
            className="flex flex-col items-center justify-center p-3 rounded-lg border-b-4 border-red-500 bg-white hover:bg-red-50 transition-all active:scale-95 shadow-sm border border-gray-200"
        >
            <span className="text-xl md:text-2xl font-bold text-gray-800 mb-1">{mistakes.dibantu}</span>
            <span className="text-[10px] font-bold text-red-500 uppercase">Dibantu (-2)</span>
        </button>
        <button 
            onClick={() => handleMistake('ditegur')}
            className="flex flex-col items-center justify-center p-3 rounded-lg border-b-4 border-yellow-500 bg-white hover:bg-yellow-50 transition-all active:scale-95 shadow-sm border border-gray-200"
        >
            <span className="text-xl md:text-2xl font-bold text-gray-800 mb-1">{mistakes.ditegur}</span>
            <span className="text-[10px] font-bold text-yellow-500 uppercase">Ditegur (-1)</span>
        </button>
        <button 
            onClick={() => handleMistake('berhenti')}
            className="flex flex-col items-center justify-center p-3 rounded-lg border-b-4 border-gray-400 bg-white hover:bg-gray-50 transition-all active:scale-95 shadow-sm border border-gray-200"
        >
            <span className="text-xl md:text-2xl font-bold text-gray-800 mb-1">{mistakes.berhenti}</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Stop (-0.5)</span>
        </button>
      </div>
    );

    const NavigationButtons = () => (
      <div className="flex gap-2 w-full">
        <button 
          onClick={() => {
            if (currentPage > currentSession.start) {
              setImgLoading(true);
              setCurrentPage(c => c - 1);
            }
          }}
          disabled={currentPage <= currentSession.start}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <ChevronLeft size={20} /> <span className="hidden md:inline">Sebelumnya</span>
        </button>
        
        {currentPage < currentSession.end ? (
          <button 
            onClick={() => {
              if (currentPage < currentSession.end) {
                setImgLoading(true);
                setCurrentPage(c => c + 1);
              }
            }}
            className="flex-[2] flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg hover:bg-emerald-800 shadow-sm transition-colors"
          >
            Lanjut <ChevronRight size={20} />
          </button>
        ) : (
          <button 
            onClick={handleFinishExam}
            className="flex-[2] flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm font-bold transition-colors"
          >
            <Save size={20} /> SELESAI
          </button>
        )}
      </div>
    );

    // --- FULL SCREEN LAYOUT ---
    if (isFullScreen) {
      return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col h-screen animate-fade-in">
          {/* FS Header */}
          <div className="bg-white/95 backdrop-blur shadow-sm border-b px-4 py-2 flex justify-between items-center z-20 shrink-0">
             <div className="flex items-center gap-4">
                <div>
                   <h2 className="font-bold text-gray-800 text-lg leading-none">{currentSession.student.name}</h2>
                   <p className="text-xs text-gray-600 font-medium mt-1">{examLabel}</p>
                </div>
                <div className="h-8 w-[1px] bg-gray-300 mx-2 hidden md:block"></div>
                <div className="hidden md:block">
                   <div className="text-[10px] text-gray-400 uppercase font-bold">Nilai</div>
                   <div className={`text-xl font-black ${score >= 70 ? 'text-primary' : 'text-red-500'}`}>{score.toFixed(1)}</div>
                </div>
             </div>
             
             <div className="flex items-center gap-2 md:gap-4">
                 {/* Zoom Controls */}
                 <div className="hidden md:flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg">
                    <button 
                       onClick={handleZoomOut} 
                       className="p-1 hover:bg-white rounded text-gray-600 active:scale-95" 
                       title="Perkecil"
                    >
                        <ZoomOut size={16}/>
                    </button>
                    <span className="text-xs font-mono w-10 text-center font-semibold text-gray-600">
                        {Math.round(zoomLevel * 100)}%
                    </span>
                    <button 
                        onClick={handleZoomIn} 
                        className="p-1 hover:bg-white rounded text-gray-600 active:scale-95" 
                        title="Perbesar"
                    >
                        <ZoomIn size={16}/>
                    </button>
                    <button 
                        onClick={handleResetZoom}
                        className="ml-1 p-1 hover:bg-white rounded text-gray-400 hover:text-gray-600"
                        title="Reset Tampilan"
                    >
                        <RotateCcw size={14}/>
                    </button>
                 </div>

                 {/* Brightness Control */}
                 <div className="hidden md:flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
                    <Sun size={14} className="text-gray-400" />
                    <input 
                      type="range" 
                      min="80" max="150" 
                      value={imageBrightness} 
                      onChange={(e) => setImageBrightness(parseInt(e.target.value))}
                      className="w-20 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                    />
                 </div>

                 <button 
                    onClick={() => setIsFullScreen(false)}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Minimize2 size={16} /> <span className="hidden md:inline">Keluar</span>
                  </button>
             </div>
          </div>

          {/* FS Body (Image) */}
          <div className="flex-1 relative overflow-auto bg-white flex items-center justify-center p-4 pb-8">
             {imgLoading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white">
                 <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
               </div>
             )}
             
             {/* Image Container with Dynamic Height for Zoom Effect */}
             <div 
               className="relative transition-all duration-200 ease-out"
               style={{ 
                   height: `${zoomLevel * 100}%`,
                   minHeight: '100%',
                   display: imgLoading ? 'none' : 'flex',
                   alignItems: 'center',
                   justifyContent: 'center'
               }}
             >
                <img 
                    src={imageUrl} 
                    alt={`Page ${currentPage}`}
                    className="h-full w-auto object-contain max-w-none shadow-sm"
                    onLoad={() => { setImgLoading(false); setImgError(false); }}
                    onError={() => { setImgLoading(false); setImgError(true); }}
                    style={{ 
                        filter: `brightness(${imageBrightness}%) contrast(1.1)`,
                    }}
                />
             </div>
          </div>

          {/* FS Footer Controls */}
          <div className="bg-white border-t p-3 md:p-4 z-20 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] relative">
             {/* Page Number Label - Tab Style on Top of Footer */}
             <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-gray-500 px-3 py-0.5 rounded-full text-[10px] font-bold border border-gray-200 shadow-sm z-30">
                HALAMAN {currentPage}
             </div>

             <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4">
                <div className="w-full md:w-auto flex-1">
                   <ScoringButtons layout="horizontal" />
                </div>
                <div className="w-full md:w-80">
                   <NavigationButtons />
                </div>
             </div>
          </div>
        </div>
      );
    }

    // --- STANDARD LAYOUT ---
    return (
      <div className="flex flex-col lg:flex-row h-[calc(100vh-160px)] gap-4 animate-fade-in">
        {/* Left: Mushaf */}
        <div className="relative bg-amber-50 rounded-xl overflow-hidden shadow-inner border border-amber-100 flex-1 flex flex-col">
          <button 
            onClick={() => setIsFullScreen(true)}
            className="absolute top-4 right-4 z-20 bg-white/80 hover:bg-white p-2 rounded-full shadow-md text-gray-700 hover:text-primary transition-all backdrop-blur-sm"
            title="Masuk Mode Full Screen"
          >
            <Maximize2 size={20} />
          </button>

          <div className="flex-1 overflow-y-auto flex items-start justify-center p-4 bg-[radial-gradient(#d97706_0.5px,transparent_0.5px)] [background-size:20px_20px]">
             {imgLoading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-amber-50 z-10">
                 <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                 <p className="mt-4 text-amber-700 font-medium">Memuat Mushaf...</p>
               </div>
             )}
             {imgError && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-amber-50 z-10 text-red-500">
                 <AlertTriangle size={48} />
                 <p className="mt-2">Gagal memuat gambar halaman {currentPage}</p>
               </div>
             )}
             <img 
               src={imageUrl} 
               alt={`Page ${currentPage}`}
               className="shadow-lg rounded max-w-full h-auto"
               onLoad={() => { setImgLoading(false); setImgError(false); }}
               onError={() => { setImgLoading(false); setImgError(true); }}
               style={{ display: imgLoading ? 'none' : 'block' }}
             />
          </div>
          <div className="bg-white p-3 border-t text-center text-sm font-bold text-gray-500 shrink-0">
            Halaman {currentPage}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="w-full lg:w-96 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col shrink-0">
          <div className="p-4 border-b bg-gray-50 rounded-t-xl">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-bold text-lg text-gray-800 leading-tight">{currentSession.student.name}</h2>
                <p className="text-sm text-gray-500 mt-1 font-medium">{examLabel}</p>
              </div>
              <ScoreBoard />
            </div>
          </div>

          <div className="p-4">
            <ScoringButtons layout="vertical" />
          </div>

          <div className="flex-1"></div>

          <div className="p-4 border-t space-y-3">
            <NavigationButtons />
            <button 
              onClick={handleCancelExam}
              className="w-full text-xs text-red-500 hover:text-red-700 py-2"
            >
              Batalkan Ujian
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-xl font-bold text-gray-800">Riwayat Ujian Tahfidz</h2>
           <p className="text-sm text-gray-500">Daftar hasil ujian santri</p>
        </div>
        {canStartExam && (
          <button 
            onClick={() => setViewMode('setup')}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-emerald-800 transition-colors shadow-sm font-medium"
          >
            <Play size={18} />
            Mulai Ujian Live
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <Award className="mx-auto text-gray-300 mb-3" size={48} />
            <p className="text-gray-500">Belum ada data ujian yang terekam.</p>
          </div>
        ) : (
          exams
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .filter(e => {
            if(user.role === 'parent' && user.childId) return e.studentId === user.childId;
            return true;
          })
          .map(exam => {
            const student = students.find(s => s.id === exam.studentId);
            const statusColor = exam.score >= 70 ? 'bg-green-500' : exam.score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
            const statusText = exam.score >= 70 ? 'LULUS' : exam.score >= 50 ? 'REMEDIAL' : 'GAGAL';

            // Konstruksi tampilan detail: Juz X, Hal Y-Z
            // Handle baik data lokal (nested) maupun data DB (flat 'juz')
            const juzDisplay = exam.juz || exam.details?.juz || '-';
            const rangeDisplay = exam.details 
               ? (exam.details.surat.startsWith('Hal') 
                   ? `Hal ${exam.details.halaman}` 
                   : exam.details.surat) 
               : exam.category;

            return (
              <div key={exam.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className={`h-1.5 w-full ${statusColor}`}></div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg leading-tight">{student?.name}</h3>
                      <p className="text-xs text-gray-500 mb-2">{student?.class}</p>
                      
                      {/* Tampilan Juz dan Halaman */}
                      <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md text-sm font-medium border border-emerald-100">
                         <span>{juzDisplay}</span>
                         <span className="text-emerald-300">|</span>
                         <span>{rangeDisplay}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-2xl font-black ${exam.score >= 70 ? 'text-green-600' : exam.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {exam.score}
                      </span>
                      <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${statusColor}`}>
                        {statusText}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2 mb-3">
                     <div className="flex justify-between text-gray-600">
                       <span>Tanggal</span>
                       <span className="font-medium">{new Date(exam.date).toLocaleDateString()}</span>
                     </div>
                     <div className="flex justify-between text-gray-600">
                       <span>Penguji</span>
                       <span className="font-medium">{exam.examiner}</span>
                     </div>
                     {exam.details && (
                       <div className="pt-2 border-t border-gray-200 mt-2 flex justify-between text-xs text-gray-500">
                         <span>Mistakes:</span>
                         <span className="font-mono">
                           Total: {Object.values(exam.details.mistakes).reduce((a: number, b: number) => a + b, 0)}
                         </span>
                       </div>
                     )}
                  </div>
                  {canDelete && onDeleteExam && (
                    <button 
                      onClick={() => {
                        if(confirm("Hapus data ujian ini?")) onDeleteExam(exam.id);
                      }}
                      className="w-full mt-2 text-xs text-red-400 hover:text-red-600 flex items-center justify-center gap-1 py-1"
                    >
                      <Trash2 size={12} /> Hapus Data
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-[500px]">
      {viewMode === 'list' && renderList()}
      {viewMode === 'setup' && renderSetup()}
      {viewMode === 'live' && renderLiveExam()}
    </div>
  );
};

export default ExamView;
