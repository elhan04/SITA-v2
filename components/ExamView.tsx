
import React, { useState, useEffect } from 'react';
import { User, Student, Exam } from '../types';
import { QURAN_CHAPTERS } from '../constants';
import { Award, Play, ChevronLeft, ChevronRight, AlertTriangle, Maximize2, Minimize2, Sun, ZoomIn, ZoomOut, RotateCcw, Save, Trash2 } from 'lucide-react';

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
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [examMode, setExamMode] = useState<ExamMode>('halaman');
  const [startPage, setStartPage] = useState<number>(1);
  const [packetSize, setPacketSize] = useState<number>(10);
  const [selectedSurah, setSelectedSurah] = useState<string>('1');

  const [currentSession, setCurrentSession] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [score, setScore] = useState<number>(100);
  const [mistakes, setMistakes] = useState({ dibantu: 0, ditegur: 0, berhenti: 0 });
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [imageBrightness, setImageBrightness] = useState(100);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const savedSession = localStorage.getItem('sita_live_exam_session_v1');
    if (savedSession) {
      try {
        const data = JSON.parse(savedSession);
        const studentExists = students.find(s => s.id === data.currentSession?.student?.id);
        if (data.viewMode === 'live' && data.currentSession && studentExists) {
            setCurrentSession(data.currentSession);
            setCurrentPage(data.currentPage);
            setScore(data.score);
            setMistakes(data.mistakes);
            setExamMode(data.examMode);
            setIsFullScreen(data.isFullScreen);
            setImageBrightness(data.imageBrightness || 100);
            setZoomLevel(data.zoomLevel || 1);
            setViewMode('live');
        } else localStorage.removeItem('sita_live_exam_session_v1');
      } catch (e) { localStorage.removeItem('sita_live_exam_session_v1'); }
    }
  }, [students]);

  useEffect(() => {
    if (viewMode === 'live' && currentSession) {
      localStorage.setItem('sita_live_exam_session_v1', JSON.stringify({
        viewMode, currentSession, currentPage, score, mistakes, examMode, isFullScreen, imageBrightness, zoomLevel
      }));
    } else if (viewMode === 'list') localStorage.removeItem('sita_live_exam_session_v1');
  }, [viewMode, currentSession, currentPage, score, mistakes, examMode, isFullScreen, imageBrightness, zoomLevel]);

  const handleStartExam = () => {
    if (!selectedStudentId) return alert("Pilih santri");
    const student = students.find(s => s.id === selectedStudentId);
    let start = 0, end = 0, label = '';
    if (examMode === 'halaman') {
      start = startPage;
      end = Math.min(604, startPage + packetSize - 1);
      label = `Hal ${start} - ${end}`;
    } else {
      const surahIdx = parseInt(selectedSurah);
      const surahData = QURAN_CHAPTERS.find(s => s[0] === surahIdx);
      if (surahData) { start = surahData[2]; end = Math.min(604, start + 2); label = `QS. ${surahData[1]}`; }
    }
    setCurrentSession({ student, mode: examMode, start, end, label });
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
    const penalty = (newMistakes.dibantu * 2) + (newMistakes.ditegur * 1) + (newMistakes.berhenti * 0.5);
    setScore(Math.max(0, 100 - penalty));
  };

  const handleFinishExam = () => {
    if (!confirm("Simpan Nilai?")) return;
    const finalScore = parseFloat(score.toFixed(1));
    const status = finalScore >= 70 ? 'pass' : 'fail';
    const juzString = `Juz ${Math.ceil(currentSession.start / 20)}`;
    onAddExam({
      id: Math.random().toString(36).substr(2, 9),
      studentId: currentSession.student.id,
      date: new Date().toISOString().split('T')[0],
      category: `${currentSession.label}`,
      score: finalScore,
      examiner: user.name,
      status: status,
      notes: status.toUpperCase(),
      juz: juzString,
      details: { juz: juzString, surat: examMode === 'surat' ? currentSession.label : `Hal ${currentSession.start}`, halaman: `${currentSession.start}-${currentSession.end}`, mistakes }
    });
    localStorage.removeItem('sita_live_exam_session_v1');
    setCurrentSession(null);
    setViewMode('list');
  };

  const renderLiveExam = () => {
    const imageUrl = `https://android.quran.com/data/width_1024/page${currentPage.toString().padStart(3, '0')}.png`;
    const NavigationButtons = () => (
      <div className="flex gap-2 w-full">
        <button onClick={() => { if (currentPage > currentSession.start) { setImgLoading(true); setCurrentPage(c => c - 1); }}} disabled={currentPage <= currentSession.start} className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-600 rounded-lg disabled:opacity-50"><ChevronLeft size={20} /> <span className="hidden md:inline">Sebelumnya</span></button>
        {currentPage < currentSession.end ? (
          <button onClick={() => { setImgLoading(true); setCurrentPage(c => c + 1); }} className="flex-[2] flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg shadow-sm">Lanjut <ChevronRight size={20} /></button>
        ) : (
          <button onClick={handleFinishExam} className="flex-[2] flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg font-bold"><Save size={20} /> SELESAI</button>
        )}
      </div>
    );

    if (isFullScreen) {
      return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col h-[100dvh] animate-fade-in">
          <div className="bg-white/95 backdrop-blur shadow-sm border-b px-4 py-2 flex justify-between items-center z-20 shrink-0">
             <div><h2 className="font-bold text-gray-800 text-lg leading-none">{currentSession.student.name}</h2><p className="text-[10px] text-gray-500 mt-1 uppercase">HALAMAN {currentPage}</p></div>
             <div className="flex items-center gap-2">
                 <div className="hidden md:flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full"><Sun size={14} className="text-gray-400" /><input type="range" min="80" max="150" value={imageBrightness} onChange={(e) => setImageBrightness(parseInt(e.target.value))} className="w-20 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer" /></div>
                 <button onClick={() => setIsFullScreen(false)} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium"><Minimize2 size={16} /></button>
             </div>
          </div>
          <div className="flex-1 relative overflow-auto bg-white flex items-center justify-center p-4">
             {imgLoading && <div className="absolute inset-0 flex items-center justify-center z-10 bg-white"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}
             <div className="relative" style={{ height: `${zoomLevel * 100}%`, minHeight: '100%', display: imgLoading ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={imageUrl} alt={`Page ${currentPage}`} className="h-full w-auto shadow-sm" onLoad={() => { setImgLoading(false); setImgError(false); }} onError={() => { setImgLoading(false); setImgError(true); }} style={{ filter: `brightness(${imageBrightness}%) contrast(1.1)` }} />
             </div>
          </div>
          {/* FOOTER: Ditambah pb-12 untuk menghindari terpotong browser mobile */}
          <div className="bg-white border-t p-3 md:p-4 pb-12 md:pb-6 z-20 shrink-0 shadow-lg relative">
             <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4">
                <div className="grid grid-cols-3 gap-3 w-full md:flex-1">
                    <button onClick={() => handleMistake('dibantu')} className="flex flex-col items-center p-2 rounded-lg border bg-white"><span className="text-lg font-bold">{mistakes.dibantu}</span><span className="text-[8px] text-red-500 uppercase font-bold">DIBANTU</span></button>
                    <button onClick={() => handleMistake('ditegur')} className="flex flex-col items-center p-2 rounded-lg border bg-white"><span className="text-lg font-bold">{mistakes.ditegur}</span><span className="text-[8px] text-yellow-600 uppercase font-bold">DITEGUR</span></button>
                    <button onClick={() => handleMistake('berhenti')} className="flex flex-col items-center p-2 rounded-lg border bg-white"><span className="text-lg font-bold">{mistakes.berhenti}</span><span className="text-[8px] text-gray-500 uppercase font-bold">STOP</span></button>
                </div>
                <div className="w-full md:w-80"><NavigationButtons /></div>
             </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col lg:flex-row h-[calc(100vh-160px)] gap-4 animate-fade-in">
        <div className="relative bg-amber-50 rounded-xl overflow-hidden shadow-inner border border-amber-100 flex-1 flex flex-col">
          <button onClick={() => setIsFullScreen(true)} className="absolute top-4 right-4 z-20 bg-white/80 p-2 rounded-full shadow-md text-gray-700"><Maximize2 size={20} /></button>
          <div className="flex-1 overflow-y-auto flex items-start justify-center p-4">
             {imgLoading && <div className="absolute inset-0 flex items-center justify-center bg-amber-50 z-10"><div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>}
             <img src={imageUrl} alt={`Page ${currentPage}`} className="shadow-lg rounded max-w-full h-auto" onLoad={() => { setImgLoading(false); setImgError(false); }} style={{ display: imgLoading ? 'none' : 'block' }} />
          </div>
          <div className="bg-white p-3 border-t text-center text-sm font-bold text-gray-500">Halaman {currentPage}</div>
        </div>
        <div className="w-full lg:w-96 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col shrink-0">
          <div className="p-4 border-b bg-gray-50 rounded-t-xl flex justify-between items-center"><div><h2 className="font-bold text-gray-800 leading-tight">{currentSession.student.name}</h2><p className="text-xs text-gray-500 mt-1">{currentSession.label}</p></div><div className="text-right"><div className="text-[10px] text-gray-400 font-bold">NILAI</div><div className="text-3xl font-black text-primary">{score.toFixed(1)}</div></div></div>
          <div className="p-4 space-y-4">
             <div className="grid grid-cols-3 gap-3">
                <button onClick={() => handleMistake('dibantu')} className="p-3 rounded-lg border-b-4 border-red-500 bg-white text-center shadow-sm"><span className="text-xl font-bold">{mistakes.dibantu}</span><span className="block text-[8px] text-red-500 font-bold">DIBANTU</span></button>
                <button onClick={() => handleMistake('ditegur')} className="p-3 rounded-lg border-b-4 border-yellow-500 bg-white text-center shadow-sm"><span className="text-xl font-bold">{mistakes.ditegur}</span><span className="block text-[8px] text-yellow-600 font-bold">DITEGUR</span></button>
                <button onClick={() => handleMistake('berhenti')} className="p-3 rounded-lg border-b-4 border-gray-400 bg-white text-center shadow-sm"><span className="text-xl font-bold">{mistakes.berhenti}</span><span className="block text-[8px] text-gray-500 font-bold">STOP</span></button>
             </div>
          </div>
          <div className="flex-1"></div>
          <div className="p-4 border-t space-y-3"><NavigationButtons /><button onClick={() => { if(confirm("Batal?")) setViewMode('list'); }} className="w-full text-xs text-red-500">Batalkan Ujian</button></div>
        </div>
      </div>
    );
  };

  const renderSetup = () => (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6 border-b pb-4"><h3 className="text-xl font-bold text-gray-800">Mulai Ujian Baru</h3><button onClick={() => setViewMode('list')} className="text-gray-500">Batal</button></div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Kelas</label><select className="w-full border rounded-lg p-2.5 bg-gray-50" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}><option value="">Pilih...</option>{Array.from(new Set(students.map(s => s.class))).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="block text-sm font-medium mb-1">Santri</label><select className="w-full border rounded-lg p-2.5 bg-gray-50" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}><option value="">Pilih...</option>{students.filter(s => !selectedClass || s.class === selectedClass).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
        <div className="bg-gray-100 p-1 rounded-lg flex"><button className={`flex-1 py-2 rounded-md text-sm font-medium ${examMode === 'halaman' ? 'bg-white shadow text-primary' : 'text-gray-500'}`} onClick={() => setExamMode('halaman')}>Halaman</button><button className={`flex-1 py-2 rounded-md text-sm font-medium ${examMode === 'surat' ? 'bg-white shadow text-primary' : 'text-gray-500'}`} onClick={() => setExamMode('surat')}>Surat</button></div>
        {examMode === 'halaman' ? (
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium">Halaman</label><input type="number" min="1" max="604" className="w-full border rounded-lg p-2.5" value={startPage} onChange={(e) => setStartPage(parseInt(e.target.value) || 1)} /></div>
            <div><label className="text-sm font-medium">Paket</label><select className="w-full border rounded-lg p-2.5" value={packetSize} onChange={(e) => setPacketSize(parseInt(e.target.value))}><option value={10}>10 Hal</option><option value={20}>20 Hal</option></select></div>
          </div>
        ) : (
          <div><label className="text-sm font-medium">Pilih Surat</label><select className="w-full border rounded-lg p-2.5 bg-gray-50" value={selectedSurah} onChange={(e) => setSelectedSurah(e.target.value)}>{QURAN_CHAPTERS.map(q => <option key={q[0]} value={q[0]}>{q[0]}. {q[1]}</option>)}</select></div>
        )}
        <button onClick={handleStartExam} className="w-full py-3 bg-primary text-white rounded-lg font-bold flex items-center justify-center gap-2 mt-4">MULAI UJIAN <Award size={20} /></button>
      </div>
    </div>
  );

  return <div className="min-h-[500px]">{viewMode === 'list' && (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><div><h2 className="text-xl font-bold text-gray-800">Riwayat Ujian</h2></div>{user.role === 'teacher' && <button onClick={() => setViewMode('setup')} className="bg-primary text-white px-5 py-2.5 rounded-lg flex items-center gap-2"><Play size={18} /> Mulai Ujian</button>}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.length === 0 ? <div className="col-span-full text-center py-12 text-gray-400">Belum ada data.</div> : exams.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exam => (
          <div key={exam.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
            <div className={`h-1.5 w-full ${exam.score >= 70 ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-2"><div><h3 className="font-bold text-gray-800">{students.find(s => s.id === exam.studentId)?.name || 'Santri'}</h3><p className="text-xs text-gray-400">{exam.category}</p></div><div className="text-right font-black text-xl">{exam.score}</div></div>
              <div className="text-xs text-gray-500 flex justify-between mt-4"><span>{exam.date}</span><span>{exam.examiner}</span></div>
              {(user.role === 'admin' || user.role === 'teacher') && onDeleteExam && <button onClick={() => onDeleteExam(exam.id)} className="w-full mt-4 text-xs text-red-500 text-center flex items-center justify-center gap-1"><Trash2 size={12}/> Hapus</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )}{viewMode === 'setup' && renderSetup()}{viewMode === 'live' && renderLiveExam()}</div>;
};

export default ExamView;
