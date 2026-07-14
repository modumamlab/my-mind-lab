/* =========================================================
   모두의 마음연구소 사용자 페이지 App
   파일 역할: 메인 홈페이지, 회원가입/로그인, 예약, AI 마음상담 화면

   대표님이 자주 수정할 위치 찾기
   1) AI 마음상담 질문: aiIntakeQuestions 검색
   2) AI 마음정리/리포트 문구: createAiMindReport 검색
   3) 심리검사 추천: recommendTestsAfterInterview 검색
   4) 예약/결제 금액: getPaymentInfo 검색
   5) 관리자 페이지: 홈페이지에는 버튼 노출 없음. /admin/index.html 직접 접속
   6) 회원 단계/유료 권한: hasPaidAccess 검색
   7) 마이페이지 진행카드: myPageSection 검색
========================================================= */

        const { useState, useEffect, useRef } = React;

        /* [MOD-20260714-RESERVATION-IDB-BRIDGE]
           localStorage 용량과 무관하게 사용자 예약과 관리자 화면이 같은 예약을 읽도록
           IndexedDB에 예약을 함께 저장합니다. */
        const MODUMAM_DB_NAME = "modumam_operating_db";
        const MODUMAM_DB_VERSION = 1;
        const MODUMAM_RESERVATION_STORE = "reservations";

        const openModumamDatabase = () => new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("이 브라우저는 IndexedDB를 지원하지 않습니다."));
                return;
            }
            const request = indexedDB.open(MODUMAM_DB_NAME, MODUMAM_DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(MODUMAM_RESERVATION_STORE)) {
                    db.createObjectStore(MODUMAM_RESERVATION_STORE, { keyPath: "id" });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("예약 저장소를 열 수 없습니다."));
        });

        const saveReservationToIndexedDB = async (reservation) => {
            const db = await openModumamDatabase();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(MODUMAM_RESERVATION_STORE, "readwrite");
                tx.objectStore(MODUMAM_RESERVATION_STORE).put(reservation);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error || new Error("예약 저장에 실패했습니다."));
                tx.onabort = () => reject(tx.error || new Error("예약 저장이 중단되었습니다."));
            });
            db.close();
        };

        const getReservationsFromIndexedDB = async () => {
            const db = await openModumamDatabase();
            const rows = await new Promise((resolve, reject) => {
                const tx = db.transaction(MODUMAM_RESERVATION_STORE, "readonly");
                const request = tx.objectStore(MODUMAM_RESERVATION_STORE).getAll();
                request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
                request.onerror = () => reject(request.error || new Error("예약을 불러오지 못했습니다."));
            });
            db.close();
            return rows;
        };

        const mergeReservationRows = (...lists) => {
            const map = new Map();
            lists.flat().filter(Boolean).forEach((item) => {
                const key = String(item.id || `${item.name || ""}-${item.phone || ""}-${item.date || ""}-${item.time || ""}`);
                map.set(key, { ...(map.get(key) || {}), ...item });
            });
            return [...map.values()].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        };

        // React-Safe Inline SVG Icon Component to completely prevent DOM-manipulation bugs
        const Icon = ({ name, className = "w-5 h-5" }) => {
            const icons = {
                'heart': (
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                ),
                'activity': (
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                ),
                'user-check': (
                    <g>
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <polyline points="16 11 18 13 22 9" />
                    </g>
                ),
                'baby': (
                    <g>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 11.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M13 11.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0" />
                        <path d="M10 15c.5.5 1.2.75 2 .75s1.5-.25 2-.75" />
                    </g>
                ),
                'compass': (
                    <g>
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </g>
                ),
                'users': (
                    <g>
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </g>
                ),
                'refresh-cw': (
                    <g>
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 16h5v5" />
                    </g>
                ),
                'check': (
                    <polyline points="20 6 9 17 4 12" />
                ),
                'alert-circle': (
                    <g>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" x2="12" y1="8" y2="12" />
                        <line x1="12" x2="12.01" y1="16" y2="16" />
                    </g>
                ),
                'sparkles': (
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                ),
                'smile': (
                    <g>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" x2="9.01" y1="9" y2="9" />
                        <line x1="15" x2="15.01" y1="9" y2="9" />
                    </g>
                ),
                'help-circle': (
                    <g>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" x2="12.01" y1="17" y2="17" />
                    </g>
                ),
                'chevron-right': (
                    <polyline points="9 18 15 12 9 6" />
                ),
                'calendar': (
                    <g>
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                        <line x1="16" x2="16" y1="2" y2="6" />
                        <line x1="8" x2="8" y1="2" y2="6" />
                        <line x1="3" x2="21" y1="10" y2="10" />
                    </g>
                ),
                'map-pin': (
                    <g>
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                    </g>
                ),
                'navigation': (
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                ),
                'video': (
                    <g>
                        <path d="m22 8-6 4 6 4V8Z" />
                        <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                    </g>
                ),
                'message-square': (
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                ),
                'layout-list': (
                    <g>
                        <line x1="21" x2="3" y1="6" y2="6" />
                        <line x1="21" x2="9" y1="12" y2="12" />
                        <line x1="21" x2="9" y1="18" y2="18" />
                        <rect width="3" height="3" x="3" y="10" rx="1" />
                        <rect width="3" height="3" x="3" y="16" rx="1" />
                    </g>
                ),
                'inbox': (
                    <g>
                        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                    </g>
                ),
                'tag': (
                    <g>
                        <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.29-7.29a1 1 0 0 0 0-1.41L12 2z" />
                        <line x1="7" x2="7.01" y1="7" y2="7" />
                    </g>
                ),
                'pencil': (
                    <path d="M12 20h9" />
                ),
                'crosshair': (
                    <g>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="22" x2="18" y1="12" y2="12" />
                        <line x1="6" x2="2" y1="12" y2="12" />
                        <line x1="12" x2="12" y1="6" y2="2" />
                        <line x1="12" x2="12" y1="22" y2="18" />
                    </g>
                ),
                'clock': (
                    <g>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </g>
                )
            };

            return (
                <svg 
                    className={className}
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                >
                    {icons[name] || null}
                </svg>
            );
        };

// 구글 시트 연동 URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzMfIWhWhl02eEgmJvXO_JGjfNNkvjQy2EFxTwB3UsMz9jU2LbqCQItC_CkReKPlOW-Ig/exec';

// 구글 시트 저장 함수
async function submitSignup(userData) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: userData.name,
        phone: userData.phone,
        email: userData.email
      })
    });

    console.log('구글 시트 저장 성공');

  } catch (error) {
    console.error('구글 시트 저장 실패', error);
  }
}
        
        function App() {
            /* =====================================================
               [MOD-20260710-023] 회원별 마음기록 저장 키
               - 이메일 → 전화번호 → 이름 순으로 회원 식별값 사용
               - 같은 브라우저에서 다른 회원이 로그인해도 기록이 섞이지 않도록 분리
            ===================================================== */
            const getRecordMemberKey = () => {
                try {
                    const user = JSON.parse(localStorage.getItem('modumamUser') || 'null');
                    const rawKey = user?.email || user?.phone || user?.name || 'guest';
                    return String(rawKey).toLowerCase().replace(/[^a-z0-9가-힣]/g, '_');
                } catch (e) {
                    return 'guest';
                }
            };

            const getTodayMindStorageKey = () =>
                `modumam_today_mind_notes_${getRecordMemberKey()}`;

            const getMindReportStorageKey = () =>
                `modumam_mind_records_${getRecordMemberKey()}`;

            const [activeTab, setActiveTab] = useState('home');
            const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
            const [selectedPunctuation, setSelectedPunctuation] = useState('all');
            const [testResult, setTestResult] = useState(null);
            const [isAdmin, setIsAdmin] = useState(false);
            const [selectedTarget, setSelectedTarget] = useState('adult');
            const [selectedTopic, setSelectedTopic] = useState('기질 및 성격 특성');
            const [memberName, setMemberName] = useState('');
            const [memberPhone, setMemberPhone] = useState('');
            const [memberEmail, setMemberEmail] = useState('');
            
            const [selectedProgram, setSelectedProgram] = useState(null);
           
            // Report Popup State
            const [showReport, setShowReport] = useState(false);
            const [selectedReport, setSelectedReport] = useState(null);
            
            // Reservation State
           const [reservations, setReservations] = useState(() => {
               try {
                   const saved = JSON.parse(localStorage.getItem("modumam_reservations") || "[]");
                   return Array.isArray(saved) ? saved.filter(item => Number(item?.id) !== 1 || item?.phone !== '010-1234-5678') : [];
               } catch (e) {
                   return [];
               }
           });

           useEffect(() => {
               let active = true;
               getReservationsFromIndexedDB()
                   .then((indexedRows) => {
                       if (!active || !indexedRows.length) return;
                       setReservations((current) => mergeReservationRows(current, indexedRows));
                   })
                   .catch(() => {});
               return () => { active = false; };
           }, []);


           // [MOD-20260714-RESERVATION-DIRECT-BRIDGE]
           // 관리자 화면이 현재 예약목록을 요청하면 사용자 페이지가 직접 응답합니다.
           useEffect(() => {
               if (typeof BroadcastChannel === "undefined") return undefined;
               const channel = new BroadcastChannel("modumam_operating_sync");
               const handleMessage = (event) => {
                   if (event.data?.type === "request-reservations") {
                       channel.postMessage({
                           type: "reservations-sync",
                           reservations,
                           at: Date.now()
                       });
                   }
               };
               channel.addEventListener("message", handleMessage);
               return () => {
                   channel.removeEventListener("message", handleMessage);
                   channel.close();
               };
           }, [reservations]);
            
            // Booking form inputs
            const [bookingName, setBookingName] = useState('');
            const [bookingPhone, setBookingPhone] = useState('');
            const [bookingType, setBookingType] = useState('장소 조율(대면)');
            const [bookingDate, setBookingDate] = useState('');
            const [bookingTime, setBookingTime] = useState('');
            // [MOD-20260714-BOOKING-OPERATING-SETTINGS] 관리자 환경설정과 예약시간을 연결합니다.
            const bookingOperatingSettings = (() => {
                const defaults = {
                    openTime: '09:00', closeTime: '18:00', intervalMinutes: 30,
                    enabledMethods: ['장소 조율(대면)', '찾아가는(대면)', 'Zoom(비대면)', 'AI(비대면)']
                };
                try {
                    return { ...defaults, ...(JSON.parse(localStorage.getItem('modumam_operating_settings') || '{}')) };
                } catch (e) {
                    return defaults;
                }
            })();
            const bookingTimeOptions = (() => {
                const toMinutes = (value) => {
                    const [h, m] = String(value || '00:00').split(':').map(Number);
                    return h * 60 + m;
                };
                const start = toMinutes(bookingOperatingSettings.openTime);
                const end = toMinutes(bookingOperatingSettings.closeTime);
                const step = Math.max(30, Number(bookingOperatingSettings.intervalMinutes) || 30);
                const values = [];
                for (let minutes = start; minutes <= end; minutes += step) {
                    values.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
                }
                return values;
            })();
            const [bookingProgram, setBookingProgram] = useState('개인 마음이음');
            const [selectedTests, setSelectedTests] = useState([]);
            const [bookingAlert, setBookingAlert] = useState(null);

            const getBookingMethodGuide = (type) => {
                const guides = {
                    '장소 조율(대면)': {
                        title: '장소 조율(대면)',
                        text: '내담자와 상담사가 협의하여 천안·아산 지역의 편안하고 안전한 상담 장소를 정합니다.'
                    },
                    '찾아가는(대면)': {
                        title: '찾아가는(대면)',
                        text: '이동이 어렵거나 익숙한 환경에서 상담받기를 원하는 경우, 협의된 기관이나 가정으로 찾아가 진행합니다.'
                    },
                    'Zoom(비대면)': {
                        title: '화상(비대면)',
                        text: 'Zoom을 이용해 얼굴을 보며 진행하는 비대면 해석상담입니다. 안정적인 인터넷과 조용한 공간이 필요합니다.'
                    },
                    'AI(비대면)': {
                        title: 'AI(비대면)',
                        text: '임상심리사가 검토·승인한 결과보고서를 AI가 먼저 전반적으로 설명한 뒤, 궁금한 내용을 글로 입력하며 채팅형으로 상담합니다. 얼굴이나 음성을 사용하지 않고 문자 대화로 진행되며, 신청 후 나의 마음기록의 상담·예약 내역에서 예약 시작시각부터 50분 동안 이용할 수 있습니다.'
                    }
                };
                return guides[type] || guides['장소 조율(대면)'];
            };


            /* =====================================================
               상담신청서 · 동의서 관리용 입력값
               - 신청서 문항을 바꾸려면 bookingApplicationForm 검색
               - 동의 문구를 바꾸려면 bookingConsentBox 검색
            ===================================================== */
            const [bookingBirth, setBookingBirth] = useState('');
            const [bookingEmail, setBookingEmail] = useState('');
            const [bookingContactMethod, setBookingContactMethod] = useState('문자');
            const [bookingClientType, setBookingClientType] = useState('직장인·일반인');
            const [bookingConcern, setBookingConcern] = useState('');
            const [bookingCounselingHistory, setBookingCounselingHistory] = useState('');
            const [bookingMedication, setBookingMedication] = useState('');
            const [bookingDiagnosis, setBookingDiagnosis] = useState('');
            const [bookingRisk, setBookingRisk] = useState('');
            const [bookingPrivacyConsent, setBookingPrivacyConsent] = useState(false);
            const [bookingServiceConsent, setBookingServiceConsent] = useState(false);
            const [bookingCounselingConsent, setBookingCounselingConsent] = useState(false);
            const [bookingCancelConsent, setBookingCancelConsent] = useState(false);
            const [bookingConsentModal, setBookingConsentModal] = useState(null);
            const [bookingSignature, setBookingSignature] = useState('');

            // Mind Chatbot / Analyzer Input
            const [mindState, setMindState] = useState('');
            const [mindPunctuation, setMindPunctuation] = useState('?');
            const [analysisResult, setAnalysisResult] = useState('');
            const [isAnalyzing, setIsAnalyzing] = useState(false);
            const [mindInputError, setMindInputError] = useState(false);
            const [mindRecords, setMindRecords] = useState(() => {
                try {
                    const memberKey = getMindReportStorageKey();
                    const memberSaved = localStorage.getItem(memberKey);
                    if (memberSaved) return JSON.parse(memberSaved);

                    // 기존 공용 저장 기록이 있으면 현재 회원 기록으로 1회 이전
                    const legacySaved = localStorage.getItem('modumam_mind_records');
                    const legacyRecords = legacySaved ? JSON.parse(legacySaved) : [];
                    if (legacyRecords.length) {
                        localStorage.setItem(memberKey, JSON.stringify(legacyRecords));
                    }
                    return legacyRecords;
                } catch (e) {
                    return [];
                }
            });

            // AI Intake Interview State
            const [intakeForm, setIntakeForm] = useState({
                concern: '',
                duration: '',
                sleep: '',
                appetite: '',
                relationship: '',
                risk: '',
                goal: ''
            });
            const [intakeResult, setIntakeResult] = useState('');

            // Test Finder State
            const [userAge, setUserAge] = useState('adult');
            const [userWorry, setUserWorry] = useState('character');

            // 회원가입 및 로그인 제어용 State
            const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
            const [authMode, setAuthMode] = useState('signup');
            const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('modumamUser'));
            const [authForm, setAuthForm] = useState({ name: '', phone: '', email: '', password: '' });
            const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
            const [isAdminPageOpen, setIsAdminPageOpen] = useState(false);
            const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
            const [adminPassword, setAdminPassword] = useState('');
            const [adminLoginError, setAdminLoginError] = useState('');
            const [intakeSummaries, setIntakeSummaries] = useState(() => {
                const saved = localStorage.getItem("modumam_intake_summaries");
                return saved ? JSON.parse(saved) : [];
            });

            const chatBodyRef = useRef(null);
            const chatInputRef = useRef(null);


            const getChatTime = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

            // AI Intake Chat / Mind Report State
            const [isAiIntakeOpen, setIsAiIntakeOpen] = useState(false);
            const [aiIntakeStep, setAiIntakeStep] = useState(0);
            const [aiIntakeMessages, setAiIntakeMessages] = useState([
                {
                    role: "ai",
                    text: "안녕하세요. 저는 모두의 마음연구소 AI 마음지기입니다.\n\n이곳은 마음이 무거울 때 편하게 이야기를 나누고, 궁금한 심리·상담·심리검사 정보도 쉬운 말로 확인할 수 있는 공간입니다.\n\n오늘 어떤 마음으로 찾아오셨나요?",
                    time: getChatTime()
                }
            ]);
            const [aiIntakeInput, setAiIntakeInput] = useState("");
            const [aiIntakeUser, setAiIntakeUser] = useState({
                     privacyAgree: false
         });
            const [aiIntakeReport, setAiIntakeReport] = useState(null);
            const [aiIntakeSessionStart, setAiIntakeSessionStart] = useState(Date.now());
            const [aiIntakeAbuseWarningCount, setAiIntakeAbuseWarningCount] = useState(0);
            const [isAiIntakeThinking, setIsAiIntakeThinking] = useState(false);
            // [MOD-20260712-001] 10분 경과 안내가 한 세션에서 한 번만 표시되도록 관리
            const [aiIntakeTenMinuteNoticeShown, setAiIntakeTenMinuteNoticeShown] = useState(false);
            // [MOD-20260712-SESSION-END] active → awaiting-report → ended
            const [aiIntakeSessionPhase, setAiIntakeSessionPhase] = useState("active");
            const aiIntakeSessionPhaseRef = useRef("active");
            const aiIntakeEndTimerRef = useRef(null);

            useEffect(() => {
                aiIntakeSessionPhaseRef.current = aiIntakeSessionPhase;
            }, [aiIntakeSessionPhase]);

            // 추천 검사 설명 팝업
            const [selectedTestPopup, setSelectedTestPopup] = useState(null);

            /* =====================================================
               [V38] AI 결과상담
               - 임상심리사 검토·승인 결과보고서를 기반으로 진행
               - 예약 시작시각부터 50분 동안 상담 버튼 활성
               - 늦게 접속해도 예약 종료시각은 연장되지 않음
            ===================================================== */
            const [aiResultCounselingOpen, setAiResultCounselingOpen] = useState(false);
            const [activeAiReservation, setActiveAiReservation] = useState(null);
            const [activeApprovedReport, setActiveApprovedReport] = useState(null);
            const [aiResultMessages, setAiResultMessages] = useState([]);
            const [aiResultInput, setAiResultInput] = useState('');
            const [aiResultThinking, setAiResultThinking] = useState(false);
            const [aiResultSummary, setAiResultSummary] = useState('');
            const [aiResultNow, setAiResultNow] = useState(Date.now());
            const aiResultChatRef = useRef(null);

            useEffect(() => {
                const timer = setInterval(() => setAiResultNow(Date.now()), 1000);
                return () => clearInterval(timer);
            }, []);

            /* [MOD-20260713-AI-RESULT-ACTIVATION]
               관리자 탭에서 AI 결과상담 활성 상태를 변경하면
               회원 화면의 예약내역에 즉시 반영되도록 예약정보를 다시 불러옵니다.
            */
            useEffect(() => {
                const reloadReservations = () => {
                    try {
                        const saved = JSON.parse(localStorage.getItem("modumam_reservations") || "[]");
                        if (Array.isArray(saved)) setReservations(saved);
                    } catch (e) {}
                };
                window.addEventListener("storage", reloadReservations);
                window.addEventListener("focus", reloadReservations);
                return () => {
                    window.removeEventListener("storage", reloadReservations);
                    window.removeEventListener("focus", reloadReservations);
                };
            }, []);

            useEffect(() => {
                if (aiResultChatRef.current) {
                    aiResultChatRef.current.scrollTop = aiResultChatRef.current.scrollHeight;
                }
            }, [aiResultMessages, aiResultThinking, aiResultSummary]);


            /* =====================================================
               [MOD-20260710-016] 나의 마음기록 패널 구조 변경
               - today: 내담자가 직접 작성하는 오늘의 마음
               - ai: AI 마음상담 기록(마음리포트 + 마음체크)
            ===================================================== */
            const [myRecordPanel, setMyRecordPanel] = useState('today');

            /* =====================================================
               [MOD-20260710-025] AI 마음상담 기록 탭 상태
               - report: AI 마음리포트
               - check: AI 마음체크
            ===================================================== */
            const [aiCounselingRecordTab, setAiCounselingRecordTab] = useState('report');

            /* =====================================================
               [MOD-20260710-028] AI 마음상담 기록 검색·정렬
               - 기록 제목/내용 검색
               - 최신순/오래된순 정렬
            ===================================================== */
            const [aiRecordSearch, setAiRecordSearch] = useState('');
            const [aiRecordSort, setAiRecordSort] = useState('newest');

            const [todayMindInput, setTodayMindInput] = useState('');

            /* =====================================================
               [MOD-20260710-030] 오늘의 마음 기록 검색·정렬
               - 기록 내용 검색
               - 최신순/오래된순 정렬
            ===================================================== */
            const [todayMindSearch, setTodayMindSearch] = useState('');
            const [todayMindSort, setTodayMindSort] = useState('newest');

            const [todayMindNotes, setTodayMindNotes] = useState(() => {
                try {
                    const memberKey = getTodayMindStorageKey();
                    const memberSaved = localStorage.getItem(memberKey);
                    if (memberSaved) return JSON.parse(memberSaved);

                    // 기존 공용 저장 기록이 있으면 현재 회원 기록으로 1회 이전
                    const legacySaved = localStorage.getItem('modumam_today_mind_notes');
                    const legacyNotes = legacySaved ? JSON.parse(legacySaved) : [];
                    if (legacyNotes.length) {
                        localStorage.setItem(memberKey, JSON.stringify(legacyNotes));
                    }
                    return legacyNotes;
                } catch (e) {
                    return [];
                }
            });

            /* =====================================================
               [MOD-20260710-020] 오늘의 마음 기록 수정·삭제
               - 기록별 수정, 저장, 취소, 삭제 기능 추가
               - 수정·삭제 후 Local Storage와 화면을 동시에 갱신
            ===================================================== */
            const [editingTodayMindId, setEditingTodayMindId] = useState(null);
            const [editingTodayMindText, setEditingTodayMindText] = useState('');

            const startEditTodayMindNote = (note) => {
                setEditingTodayMindId(note.id);
                setEditingTodayMindText(note.text || '');
            };

            const cancelEditTodayMindNote = () => {
                setEditingTodayMindId(null);
                setEditingTodayMindText('');
            };

            const saveEditedTodayMindNote = () => {
                const value = editingTodayMindText.trim();
                if (!value) {
                    alert('수정할 마음기록을 적어 주세요.');
                    return;
                }

                const updated = todayMindNotes.map((note) =>
                    note.id === editingTodayMindId
                        ? {
                            ...note,
                            text: value,
                            updatedAt: new Date().toLocaleString('ko-KR')
                        }
                        : note
                );

                setTodayMindNotes(updated);
                localStorage.setItem(getTodayMindStorageKey(), JSON.stringify(updated));
                cancelEditTodayMindNote();
            };

            const deleteTodayMindNote = (id) => {
                if (!window.confirm('이 마음기록을 삭제하시겠습니까?')) return;

                const updated = todayMindNotes.filter((note) => note.id !== id);
                setTodayMindNotes(updated);
                localStorage.setItem(getTodayMindStorageKey(), JSON.stringify(updated));

                if (editingTodayMindId === id) {
                    cancelEditTodayMindNote();
                }
            };

            /* =====================================================
               [MOD-20260710-021] 과거 AI 마음리포트 하단 안내 숨김
               - 기존 Local Storage에 저장된 리포트는 원문을 유지합니다.
               - 나의 마음기록 화면에서 볼 때만 하단 안내를 제거합니다.
               - 새로 생성되는 리포트에는 gemini.js의 간소화 문구가 적용됩니다.
            ===================================================== */
            const getCleanMindReportText = (value) => {
                const report = String(value || '');
                const cutMarkers = [
                    '\n────────────────',
                    '\n※ 본 리포트는 심리적 자기이해를 돕기 위한 참고용입니다.',
                    '\nAI 마음리포트 이용 중 오류가 발생할 경우,'
                ];

                let cutIndex = -1;
                cutMarkers.forEach((marker) => {
                    const index = report.indexOf(marker);
                    if (index !== -1 && (cutIndex === -1 || index < cutIndex)) {
                        cutIndex = index;
                    }
                });

                return (cutIndex === -1 ? report : report.slice(0, cutIndex)).trim();
            };

            /* =====================================================
               [MOD-20260710-024] 로그인 회원 변경 시 기록 다시 불러오기
            ===================================================== */
            useEffect(() => {
                try {
                    const todaySaved = localStorage.getItem(getTodayMindStorageKey());
                    const reportSaved = localStorage.getItem(getMindReportStorageKey());
                    setTodayMindNotes(todaySaved ? JSON.parse(todaySaved) : []);
                    setMindRecords(reportSaved ? JSON.parse(reportSaved) : []);
                    setEditingTodayMindId(null);
                    setEditingTodayMindText('');
                } catch (e) {
                    setTodayMindNotes([]);
                    setMindRecords([]);
                }
            }, [isLoggedIn]);

            const todayMindKeyword = todayMindSearch.trim().toLowerCase();

            const filteredTodayMindNotes = [...todayMindNotes]
                .filter((note) => {
                    if (!todayMindKeyword) return true;
                    return String(note.text || '').toLowerCase().includes(todayMindKeyword);
                })
                .sort((a, b) => {
                    const aDate = normalizeRecordDate(a.updatedAt || a.createdAt);
                    const bDate = normalizeRecordDate(b.updatedAt || b.createdAt);
                    return todayMindSort === 'oldest' ? aDate - bDate : bDate - aDate;
                });

            const saveTodayMindNote = () => {
                const value = todayMindInput.trim();
                if (!value) {
                    alert('오늘의 마음을 적어 주세요.');
                    return;
                }

                const note = {
                    id: Date.now(),
                    text: value,
                    createdAt: new Date().toLocaleString('ko-KR')
                };
                const updated = [note, ...todayMindNotes];
                setTodayMindNotes(updated);
                localStorage.setItem(getTodayMindStorageKey(), JSON.stringify(updated));
                setTodayMindInput('');
            };

            const aiIntakeQuestions = [
                { key: "opening", question: "오늘은 어떤 마음으로 찾아오셨나요? 가장 먼저 들려주고 싶은 이야기를 편하게 말씀해 주세요." },
                { key: "mainConcern", question: "제가 조금 더 잘 이해할 수 있도록, 지금 가장 힘든 부분을 하나만 꼽는다면 무엇일까요?" },
                { key: "timeline", question: "그 어려움은 언제부터 특히 크게 느껴지기 시작했나요?" },
                { key: "impact", question: "요즘 그 마음이 일상에는 어떤 영향을 주고 있나요? 잠, 식사, 일, 관계, 집중, 의욕 중 달라진 부분이 있을까요?" },
                { key: "coping", question: "그동안 이 마음을 견디기 위해 해보셨던 방법이 있었나요? 잘 되지 않았더라도 괜찮습니다." },
                { key: "expectation", question: "지금 가장 바라는 것은 무엇인가요? 단순히 들어주기를 원하시는지, 아니면 심리검사를 통해 조금 더 이해해 보고 싶으신지도 함께 알려주세요." },
                { key: "safety", question: "마지막으로 안전 확인을 위해 조심스럽게 여쭤볼게요. 최근 스스로를 해치고 싶거나, 사라지고 싶거나, 죽고 싶다는 생각이 있었나요?" }
            ]

            
  // 가입/로그인 완료 버튼 처리 함수 (수정본)
const handleAuthSubmit = async (e) => { // async 키워드 추가 필수
    e.preventDefault();
    
    if (authMode === 'signup') {
        // [수정] 구글 시트로 데이터 전송이 완료될 때까지 기다림
        await submitSignup(authForm);
        
        const templateParams = {
            name: authForm.name,
            phone: authForm.phone,
            email: authForm.email,
            date: new Date().toLocaleString()
        };
        
        // 이메일 발송 로직
        window.emailjs.send(
            'service_4bvn32a',    // Service ID
            'template_kp5prue',   // Template ID
            templateParams,
            'mrZ6YoiEw9fnGUGpB'   // Public Key
        )
        .then((response) => {
            console.log('관리자 메일 발송 성공!', response.status);
            alert(`${authForm.name}님, 회원가입이 완료되었습니다.`);
localStorage.setItem('modumamUser', JSON.stringify({ name: authForm.name, phone: authForm.phone, email: authForm.email, joinedAt: new Date().toLocaleString() }));
setIsLoggedIn(true);
setIsAuthModalOpen(false);

// ===== [MOD-20260711-001] 수정 START =====
// 회원가입 완료 후 AI 마음체크 자동 실행 제거
// AI 마음체크는 사용자가 'AI 마음체크 시작하기' 버튼을 눌렀을 때만 열립니다.
// ===== [MOD-20260711-001] 수정 END =====
})
        .catch((err) => {
            console.error('메일 발송 실패:', err);
            localStorage.setItem('modumamUser', JSON.stringify({ name: authForm.name, phone: authForm.phone, email: authForm.email, joinedAt: new Date().toLocaleString() }));
            setIsLoggedIn(true);
setIsAuthModalOpen(false);

// ===== [MOD-20260711-002] 수정 START =====
// 관리자 메일 발송 실패 시에도 회원가입은 유지하되,
// AI 마음체크 팝업은 자동으로 열지 않습니다.
// ===== [MOD-20260711-002] 수정 END =====
        });
        
    } else {
    // [MOD-20260713-RESULT-IDENTITY-FIX]
    // 검사결과는 회원 이름 또는 연락처로 연결되므로 빈 정보 로그인을 허용하지 않습니다.
    const loginName = String(authForm.name || '').trim();
    const loginPhone = String(authForm.phone || '').replace(/[^0-9]/g, '');
    if (!loginName || loginPhone.length < 8) {
        alert('검사결과와 예약내역을 안전하게 연결하려면 이름과 연락처를 모두 입력해 주세요.');
        return;
    }

    alert('로그인되었습니다.');
    localStorage.setItem('modumamUser', JSON.stringify({
        name: loginName,
        phone: loginPhone,
        email: String(authForm.email || '').trim(),
        loginAt: new Date().toLocaleString()
    }));
    setIsLoggedIn(true);
    setIsAuthModalOpen(false);

    // ===== [MOD-20260711-003] 수정 START =====
    // 로그인 후 AI 마음체크 자동 실행 제거
    // 로그인 완료 후에는 홈페이지에 그대로 머무릅니다.
    // ===== [MOD-20260711-003] 수정 END =====
}
    
    setAuthForm({ name: '', phone: '', email: '', password: '' });
};
            


            const scrollAiChatToBottom = () => {
                setTimeout(() => {
                    if (chatBodyRef.current) {
                        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
                    }
                    if (chatInputRef.current && !aiIntakeReport) {
                        chatInputRef.current.focus();
                    }
                }, 80);
            };

            useEffect(() => {
                if (isAiIntakeOpen) {
                    scrollAiChatToBottom();
                }
            }, [aiIntakeMessages, aiIntakeReport, isAiIntakeOpen]);

            // [MOD-20260712-SESSION-END] 10분이 되면 상담을 종료하고 Y 입력만 받습니다.
            useEffect(() => {
                if (!isAiIntakeOpen || aiIntakeReport || aiIntakeTenMinuteNoticeShown || aiIntakeSessionPhase !== "active") return;

                const elapsed = Date.now() - Number(aiIntakeSessionStart || Date.now());
                const remaining = Math.max(0, (10 * 60 * 1000) - elapsed);

                const timer = setTimeout(() => {
                    if (window.modumamSilenceTimer) {
                        clearTimeout(window.modumamSilenceTimer);
                        window.modumamSilenceTimer = null;
                    }

                    setIsAiIntakeThinking(false);
                    setAiIntakeSessionPhase("awaiting-report");
                    setAiIntakeTenMinuteNoticeShown(true);
                    setAiIntakeMessages((prev) => [
                        ...prev,
                        {
                            role: "ai",
                            text: `제공된 마음체크 시간이 완료되었습니다.

지금까지의 대화를 정리 중입니다.

AI 마음체크리포트를 확인하시려면 Y를 입력해 주세요.

별도의 입력이 없으면 1분 후 자동으로 종료됩니다.`,
                            time: getChatTime(),
                            noticeType: "session-complete"
                        }
                    ]);

                    if (aiIntakeEndTimerRef.current) clearTimeout(aiIntakeEndTimerRef.current);
                    aiIntakeEndTimerRef.current = setTimeout(() => {
                        if (aiIntakeSessionPhaseRef.current !== "awaiting-report") return;
                        setAiIntakeSessionPhase("ended");
                        setAiIntakeMessages((prev) => [
                            ...prev,
                            {
                                role: "ai",
                                text: `AI 마음체크가 자동으로 종료되었습니다.

오늘 나누어 주신 이야기가 현재의 마음을 이해하는 작은 도움이 되었기를 바랍니다.`,
                                time: getChatTime(),
                                noticeType: "session-ended"
                            }
                        ]);
                    }, 60 * 1000);
                }, remaining);

                return () => clearTimeout(timer);
            }, [isAiIntakeOpen, aiIntakeReport, aiIntakeSessionStart, aiIntakeTenMinuteNoticeShown, aiIntakeSessionPhase]);

            const resetAiIntake = () => {
                setAiIntakeStep(0);
                setAiIntakeInput("");
                setAiIntakeReport(null);
                setAiIntakeSessionStart(Date.now());
                setAiIntakeAbuseWarningCount(0);
                setIsAiIntakeThinking(false);
                setAiIntakeTenMinuteNoticeShown(false);
                setAiIntakeSessionPhase("active");
                aiIntakeSessionPhaseRef.current = "active";
                if (aiIntakeEndTimerRef.current) {
                    clearTimeout(aiIntakeEndTimerRef.current);
                    aiIntakeEndTimerRef.current = null;
                }
                setAiIntakeUser({
                    name: authForm.name || "",
                    phone: authForm.phone || "",
                    email: authForm.email || "",
                    privacyAgree: false
                });
                setAiIntakeMessages([
                    {
                        role: "ai",
                        text: "안녕하세요. 저는 모두의 마음연구소 AI 마음지기입니다.\n\n이곳은 마음이 무거울 때 편하게 이야기를 나누고, 궁금한 심리·상담·심리검사 정보도 쉬운 말로 확인할 수 있는 공간입니다.\n\n오늘 어떤 마음으로 찾아오셨나요?",
                        time: getChatTime()
                    }
                ]);
            };

            const openAiIntakeChat = () => {
                let savedUser = null;
                try {
                    savedUser = JSON.parse(localStorage.getItem('modumamUser') || 'null');
                } catch (e) {
                    savedUser = null;
                }

                if (!isLoggedIn && !savedUser) {
                    // v28 수정: AI 마음체크는 회원 전용이므로 alert 대신 회원가입/로그인 팝업을 바로 엽니다.
                    setAuthMode('signup');
                    setIsAuthModalOpen(true);
                    return;
                }

                resetAiIntake();
                if (savedUser) {
                    setAiIntakeUser({
                        name: savedUser.name || '',
                        phone: savedUser.phone || '',
                        email: savedUser.email || '',
                        privacyAgree: false
                    });
                }
                setIsAiIntakeOpen(true);
                setTimeout(() => chatInputRef.current?.focus(), 150);
            };

            const closeAiIntakeChat = () => {
                if (aiIntakeEndTimerRef.current) {
                    clearTimeout(aiIntakeEndTimerRef.current);
                    aiIntakeEndTimerRef.current = null;
                }
                setIsAiIntakeOpen(false);
            };

            const getAiAnswerText = (messages, index) => {
                const userMessages = messages.filter((m) => m.role === "user");
                return userMessages[index]?.text || "";
            };

            const aiText = (value) => String(value || "").toLowerCase();
            const aiHasAny = (text, words) => words.some((word) => String(text || "").includes(word));

            const inferAiTheme = (allText) => {
                const text = aiText(allText);

                const parentingWords = ["아이", "자녀", "육아", "양육", "훈육", "발달", "어린이집", "유치원", "등원", "하원", "언어", "떼", "분리불안", "또래"];
                const coupleWords = ["부부", "배우자", "남편", "아내", "커플", "결혼", "이혼"];
                // [MOD-20260712-TEST-MATCH] 진로·구직과 재직 중 직무스트레스를 분리합니다.
                const careerWords = ["구직", "취업", "재취업", "진로", "적성", "직업 선택", "채용", "면접 준비", "입사 준비"];
                const workWords = ["직장", "회사", "상사", "동료", "업무", "조직", "부서", "과로", "번아웃", "직장 스트레스", "업무 스트레스"];
                const emotionWords = ["불안", "우울", "무기력", "공황", "잠", "수면", "불면", "눈물", "답답", "분노", "짜증", "스트레스"];
                const relationshipWords = ["관계", "친구", "대인", "사람들", "소통", "갈등", "거절", "눈치", "상처", "외로움"];

                const parentingScore = parentingWords.filter((w) => text.includes(w)).length;
                const coupleScore = coupleWords.filter((w) => text.includes(w)).length;
                const careerScore = careerWords.filter((w) => text.includes(w)).length;
                const workScore = workWords.filter((w) => text.includes(w)).length;
                const emotionScore = emotionWords.filter((w) => text.includes(w)).length;
                const relationshipScore = relationshipWords.filter((w) => text.includes(w)).length;

                if (parentingScore >= 2 || (parentingScore >= 1 && aiHasAny(text, ["아이", "자녀", "육아", "양육", "발달", "훈육"]))) {
                    return { type: "parenting", label: "양육·부모-자녀", program: "부모-자녀 마음이음", core: "자녀의 신호와 부모의 부담이 함께 맞물린 어려움" };
                }
                if (coupleScore >= 1) return { type: "couple", label: "부부·관계", program: "부부 마음이음", core: "관계 안에서 반복되는 기대와 표현 방식의 어긋남" };
                if (careerScore >= 1) return { type: "career", label: "진로·구직", program: "개인 마음이음", core: "진로 선택과 취업 과정에서의 방향 탐색" };
                if (workScore >= 1) return { type: "work", label: "직장 스트레스", program: "개인 마음이음", core: "현재 직무환경에서 이어지는 긴장과 소진, 역할 부담" };
                if (emotionScore >= 1) return { type: "emotion", label: "정서·스트레스", program: "개인 마음이음", core: "불안, 우울, 무기력, 긴장 등 마음의 과부하 신호" };
                if (relationshipScore >= 1) return { type: "relationship", label: "대인관계", program: "개인 마음이음", core: "관계에서 반복되는 긴장과 자기표현의 어려움" };

                return { type: "self", label: "자기이해", program: "개인 마음이음", core: "반복되는 마음 패턴과 자기이해의 필요" };
            };

            const detectRiskLevel = (text) => {
                const lower = aiText(text);
                const highWords = ["죽고", "죽고 싶", "자살", "자해", "사라지고", "끝내고", "해치고", "극단"];
                const middleWords = ["불안", "우울", "잠", "분노", "공황", "무기력", "눈물", "숨", "답답", "불면"];
                if (highWords.some((w) => lower.includes(w))) return "높음";
                if (middleWords.some((w) => lower.includes(w))) return "주의";
                return "낮음";
            };

            const makeCounselorReply = (userText, nextQuestion, step) => {
                // v28 수정: 규칙 기반 상담 문장을 사용하지 않고, Gemini 함수 실패 시에도 연결 오류 문구를 반복하지 않습니다.
                return nextQuestion || "방금 답변을 안정적으로 완성하지 못했습니다. 같은 내용을 한 번만 다시 보내 주세요.";
            };

            const buildAssessmentPurpose = (theme, allText, riskLevel) => {
                const text = aiText(allText);
                if (riskLevel === "높음") return "안전 확인과 위기 지원을 우선합니다. 심리검사는 안정이 확보된 뒤 상담자가 필요성을 판단합니다.";
                if (theme.type === "parenting") return "아이의 발달 특성과 부모님의 양육방식을 함께 이해하여 부모-자녀 상호작용을 돕기 위한 평가가 필요합니다.";
                if (theme.type === "couple") return "두 사람의 기질과 성격 차이를 이해하여 반복되는 갈등의 패턴을 살펴보는 평가가 필요합니다.";
                if (theme.type === "career") return "흥미, 강점, 기질과 의사결정 방식을 살펴보며 구직과 진로 방향을 구체화하는 데 도움이 되는 평가를 고려할 수 있습니다.";
                if (theme.type === "work") return "현재 재직 중인 직무 환경의 영향과 개인의 스트레스 대처 특성을 함께 구분하기 위한 평가가 필요합니다.";
                if (theme.type === "relationship") return "반복되는 대인관계 패턴과 자기표현 방식을 이해하기 위한 평가가 필요합니다.";
                if (aiHasAny(text, ["불안", "우울", "무기력", "공황", "잠", "불면"])) return "현재 정서 상태와 평소 기질·성격 특성을 함께 이해하여 상담 방향을 정하기 위한 평가가 필요합니다.";
                return "반복되는 마음 패턴과 자기이해를 돕기 위한 평가가 필요합니다.";
            };

            const addRecommendedTest = (tests, name, reason, priority = 1, confidence = "높음") => {
                if (!tests.some((t) => t.name === name)) tests.push({ name, reason, priority, confidence });
            };

            const recommendTestsAfterInterview = (theme, allText, riskLevel) => {
                const text = aiText(allText);
                const tests = [];

                if (riskLevel === "높음") {
                    return [{
                        name: "전문가 안전상담 우선",
                        reason: "현재 대화에서 안전 확인이 필요한 표현이 확인되어 심리검사보다 즉각적인 도움과 전문가 상담 연결이 우선입니다.",
                        priority: 1,
                        confidence: "매우 높음"
                    }];
                }

                if (theme.type === "parenting") {
                    addRecommendedTest(tests, "PAT 부모양육태도검사", "아이의 행동만 따로 보기보다 부모님의 양육방식과 상호작용을 함께 이해하는 데 도움이 됩니다.", 1, "높음");
                    addRecommendedTest(tests, "K-CDI 아동발달검사", "자녀의 현재 발달 특성을 확인하면 연령에 맞는 기대와 양육 방향을 세우는 데 도움이 됩니다.", 2, "높음");
                    return tests.slice(0, 2);
                }

                if (theme.type === "couple") {
                    addRecommendedTest(tests, "부부 TCI 기질 및 성격검사", "서로의 기질과 성격 차이를 이해하면 반복되는 갈등과 표현 방식의 차이를 더 구체적으로 살펴볼 수 있습니다.", 1, "높음");
                    if (aiHasAny(text, ["우울", "불안", "분노", "폭발", "상처", "반복"])) addRecommendedTest(tests, "MMPI-2 성격검사", "갈등이 오래 지속되며 정서적 부담이 커진 경우 현재 심리적 부담의 폭을 확인하는 데 도움이 될 수 있습니다.", 2, "중간");
                    return tests.slice(0, 2);
                }

                if (theme.type === "career") {
                    addRecommendedTest(tests, "직업흥미검사", "관심과 선호 영역을 확인하여 구직 방향과 지원 직무를 구체화하는 데 도움이 됩니다.", 1, "높음");
                    addRecommendedTest(tests, "TCI 기질 및 성격검사", "일을 선택하고 결정하는 과정에서 자신의 기질, 성격, 대처방식을 함께 이해하는 데 도움이 됩니다.", 2, "중간");
                    return tests.slice(0, 2);
                }

                if (theme.type === "work") {
                    // 직무스트레스검사는 현재 재직 중이며 실제 업무환경·역할·조직 갈등이 확인될 때만 추천합니다.
                    const isCurrentlyWorking = aiHasAny(text, ["재직", "다니고", "근무", "출근", "회사에서", "직장에서", "상사", "동료", "업무", "부서", "조직"]);
                    const hasWorkStress = aiHasAny(text, ["과로", "번아웃", "업무 스트레스", "직장 스트레스", "역할갈등", "업무량", "상사", "동료", "조직", "부서"]);
                    if (isCurrentlyWorking && hasWorkStress) {
                        addRecommendedTest(tests, "직무스트레스검사", "현재 재직 중인 환경에서 업무량, 역할갈등, 조직관계, 소진 가운데 어떤 요인의 영향이 큰지 확인하는 데 도움이 됩니다.", 1, "높음");
                    }
                    addRecommendedTest(tests, "TCI 기질 및 성격검사", "직장 상황에서 스트레스에 반응하고 대처하는 평소의 기질과 성격 특성을 이해하는 데 도움이 됩니다.", tests.length + 1, "중간");
                    return tests.slice(0, 2);
                }

                if (theme.type === "relationship") {
                    addRecommendedTest(tests, "TCI 기질 및 성격검사", "관계에서 반복되는 반응이 기질과 성격 특성과 어떻게 연결되는지 이해하는 데 도움이 됩니다.", 1, "높음");
                    addRecommendedTest(tests, "대인관계문제검사", "관계에서 반복되는 거리감, 회피, 의존, 통제, 자기표현의 어려움을 구체적으로 확인하는 데 도움이 됩니다.", 2, "높음");
                    return tests.slice(0, 2);
                }

                if (aiHasAny(text, ["구직", "취업", "재취업", "진로", "적성", "직업 선택", "채용", "입사 준비"])) {
                    addRecommendedTest(tests, "직업흥미검사", "흥미와 선호 영역을 확인하면 앞으로의 진로 선택과 직업 방향을 구체화하는 데 도움이 됩니다.", 1, "높음");
                    addRecommendedTest(tests, "TCI 기질 및 성격검사", "진로 선택에서 반복되는 고민이 기질, 성격, 의사결정 방식과 어떻게 연결되는지 이해하는 데 도움이 됩니다.", 2, "중간");
                    return tests.slice(0, 2);
                }

                if (aiHasAny(text, ["우울", "무기력", "눈물", "허무", "의욕"])) {
                    addRecommendedTest(tests, "우울검사(무료)", "현재 우울감과 무기력의 정도를 먼저 간단히 확인하는 데 도움이 됩니다.", 1, "높음");
                    addRecommendedTest(tests, "TCI 기질 및 성격검사", "현재 정서가 평소 기질과 성격 특성과 어떻게 연결되는지 이해하는 데 도움이 됩니다.", 2, "중간");
                    return tests.slice(0, 2);
                }

                if (aiHasAny(text, ["불안", "걱정", "두려", "긴장", "공황"])) {
                    addRecommendedTest(tests, "불안검사(무료)", "현재 불안과 긴장의 정도를 먼저 간단히 확인하는 데 도움이 됩니다.", 1, "높음");
                    addRecommendedTest(tests, "TCI 기질 및 성격검사", "불안이 상황적 요인인지, 평소의 기질적 민감성과 연결되는지 살펴보는 데 도움이 됩니다.", 2, "중간");
                    return tests.slice(0, 2);
                }

                addRecommendedTest(tests, "TCI 기질 및 성격검사", "현재의 어려움을 단순한 성격 문제로 보기보다 타고난 기질과 후천적으로 형성된 성격을 구분하여 이해하는 데 도움이 됩니다.", 1, "높음");
                addRecommendedTest(tests, "문장완성검사(무료)", "말로 정리하기 어려운 감정과 마음속 반복 문장을 부담 없이 탐색하는 데 도움이 됩니다.", 2, "중간");
                return tests.slice(0, 2);
            };

            const getMindScores = (allText, riskLevel) => {
                const text = String(allText || "");
                const count = (words) => words.reduce((sum, w) => sum + (text.includes(w) ? 1 : 0), 0);
                const stress = Math.min(5, 2 + count(["스트레스", "힘들", "지쳤", "번아웃", "압박", "피로", "답답"]));
                const anxiety = Math.min(5, 1 + count(["불안", "걱정", "두려", "긴장", "공황", "초조"]));
                const depression = Math.min(5, 1 + count(["우울", "무기력", "눈물", "허무", "의욕", "공허"]));
                const relationship = Math.min(5, 1 + count(["관계", "갈등", "소통", "부부", "친구", "거절", "눈치"]));
                const energy = Math.max(1, 5 - Math.max(stress, anxiety, depression) + (riskLevel === "낮음" ? 1 : 0));
                return { stress, anxiety, depression, relationship, energy };
            };

            const barText = (score) => {
                const value = Math.max(0, Math.min(5, score));
                return "■".repeat(value) + "□".repeat(5 - value);
            };

            const extractKeywords = (allText, theme) => {
                const text = String(allText || "");
                const pool = [
                    ["불안", ["불안", "걱정", "두려", "긴장", "공황"]],
                    ["우울·무기력", ["우울", "무기력", "의욕", "눈물", "허무"]],
                    ["소진", ["번아웃", "지쳤", "피로", "쉬어도"]],
                    ["관계 스트레스", ["관계", "갈등", "부부", "친구", "소통", "눈치"]],
                    ["자기비난", ["내 탓", "부족", "못", "자책", "문제인가"]],
                    ["양육 부담", ["아이", "자녀", "양육", "육아", "훈육", "발달"]],
                    ["변화 욕구", ["상담", "도움", "달라", "바꾸", "알고 싶"]]
                ];
                const found = pool.filter(([_, words]) => words.some((word) => text.includes(word))).map(([label]) => label);
                return found.length ? [...new Set([theme.label, ...found])] : [theme.label, "마음 신호", "자기이해"];
            };

            const inferStrengths = (allText, theme) => {
                const text = String(allText || "");
                const strengths = [];
                if (text.includes("버티") || text.includes("참")) strengths.push("버텨 온 힘");
                if (theme.type === "parenting") strengths.push("돌보려는 마음");
                if (theme.type === "couple") strengths.push("관계를 회복하려는 의지");
                if (theme.type === "work") strengths.push("책임감");
                if (text.includes("상담") || text.includes("도움")) strengths.push("도움을 요청할 수 있는 용기");
                if (text.includes("알고") || text.includes("이해")) strengths.push("자기이해 의지");
                if (!strengths.length) strengths.push("자기이해 의지", "회복 가능성", "변화를 시작하려는 마음");
                return [...new Set(strengths)];
            };

            const createMindReflection = ({ theme, riskLevel }) => {
                const intro = "이번 대화에서 가장 먼저 느껴지는 것은, " + theme.core + "입니다. 지금의 어려움은 단순히 한 가지 사건만의 문제가 아니라, 마음이 오랫동안 보내온 신호들이 여러 층으로 겹쳐 나타난 것으로 보입니다.";
                const body = "\n\n말씀해 주신 내용을 종합하면, 겉으로는 특정 상황이나 고민처럼 보이지만 그 안에는 감정의 피로, 반복되는 생각, 관계나 환경에서의 부담, 그리고 ‘이제는 달라지고 싶다’는 욕구가 함께 담겨 있을 가능성이 있습니다.\n\n특히 마음이 커지는 장면과 몸의 반응은 중요한 단서입니다. 그 반응은 약함의 증거가 아니라, 마음이 더 이상 그냥 지나치지 말아 달라고 보내는 신호일 수 있습니다.\n\n또한 마음속에서 반복되는 문장이 있다면, 그 문장은 현재 어려움을 이해하는 핵심 단서가 됩니다. ‘내가 문제인가?’, ‘또 이러네’, ‘참아야지’, ‘잘해야 해’ 같은 문장은 단순한 생각이 아니라 오랫동안 익숙해진 자기대화일 수 있습니다.\n\n지금까지 버티기 위해 해온 방식도 중요합니다. 그 방법이 완벽하지 않았더라도, 그것은 지금까지 삶을 견디게 해준 나름의 생존전략이었을 수 있습니다. 다만 이제는 그 방식이 나를 계속 소진시키는지, 아니면 회복을 돕는지 구분해 볼 필요가 있습니다.";
                const closing = riskLevel === "높음"
                    ? "\n\n현재 안전과 관련된 신호가 함께 확인되므로, 심리검사보다 즉각적인 안전 확보와 주변 도움 연결이 우선입니다. 혼자 견디기 어렵다면 112, 119, 자살예방상담전화 109 또는 가까운 응급실의 도움을 먼저 요청해 주세요."
                    : "\n\n이 마음정리는 진단이 아니라 상담 전 마음을 이해하기 위한 안내입니다. 보다 정확한 이해를 위해서는 심리검사와 전문가 해석상담을 통해 현재의 마음 패턴, 강점, 조율이 필요한 부분을 함께 살펴보는 것이 좋겠습니다.";
                return intro + body + closing;
            };

            const getSmallPractice = (theme) => {
                if (theme.type === "parenting") return "오늘 아이의 행동을 바로 고치려 하기보다, 그 행동이 어떤 신호인지 10초만 멈추고 관찰해 보세요.";
                if (theme.type === "couple") return "상대에게 말하기 전, ‘내가 정말 바라는 것은 무엇인가?’를 한 문장으로 적어보세요.";
                if (theme.type === "work") return "오늘 해야 할 일을 모두 끝내려 하기보다, 에너지를 가장 많이 빼앗는 일 하나를 표시해 보세요.";
                if (theme.type === "emotion") return "지금 감정을 없애려 하지 말고, ‘나는 지금 ___을 느끼고 있다’고 한 문장으로 이름 붙여 보세요.";
                if (theme.type === "relationship") return "관계에서 내가 반복해서 참고 있는 말이 무엇인지 짧게 적어보세요.";
                return "오늘 마음에 남은 문장 하나를 적고, 그 문장 끝에 물음표를 붙여 조용히 바라보세요.";
            };

            // [MOD-20260712-REPORT-V2] 대화 내용을 바탕으로 더 깊이 있는 AI 마음체크리포트를 생성합니다.
            const createAiMindReport = (messages) => {
                const userAnswers = messages
                    .filter((m) => m.role === "user")
                    .map((m) => String(m.text || "").trim())
                    .filter(Boolean);

                const findAnswer = (patterns, exclude = []) => {
                    return userAnswers.find((answer) => {
                        if (exclude.includes(answer)) return false;
                        return patterns.some((pattern) => pattern.test(answer));
                    }) || "";
                };

                const cleanReportSentence = (value, fallback = "") => {
                    const text = String(value || "").replace(/\s+/g, " ").trim();
                    if (!text) return fallback;
                    return text.length > 150 ? `${text.slice(0, 147)}…` : text;
                };

                const mainConcern = userAnswers[0] || "";
                const feltSense = findAnswer([/피곤|지쳐|힘들|무기력|불안|긴장|무서|두려|답답|우울|화|짜증|외로|공허|슬프|몸|가슴|숨|잠/], [mainConcern]) || userAnswers[1] || "";
                const story = findAnswer([/회사|직장|상사|업무|가족|남편|아내|아이|자녀|친구|관계|학교|사건|일이|때문|오늘|어제|최근|반복/], [mainConcern, feltSense]);
                const innerSentence = findAnswer([/나는|내가|왜|또|항상|계속|해야|못|싫|무서|두려|끝|모르겠|괜찮/], [mainConcern, feltSense, story]);
                const duration = findAnswer([/부터|동안|계속|요즘|최근|매일|하루하루|개월|주일|년|오래|반복/], [mainConcern, feltSense, story, innerSentence]);
                const impact = findAnswer([/잠|수면|식사|밥|일상|출근|집중|관계|의욕|일을|생활|못하|영향/], [mainConcern, feltSense, story, innerSentence, duration]);
                const coping = findAnswer([/참|버티|쉬|잠|운동|술|피하|견디|해봤|노력|상담|도움/], [mainConcern, feltSense, story, innerSentence, duration, impact]);
                const goal = findAnswer([/바라|원해|싶어|정리|알고|이해|검사|상담|도움|달라지고|회복/], [mainConcern, feltSense, story, innerSentence, duration, impact, coping]);
                const risk = findAnswer([/자살|죽고|자해|사라지고|끝내고|해치고|극단|목숨|유서/]);

                const allText = userAnswers.join(" ");
                const theme = inferAiTheme(allText);
                const riskLevel = detectRiskLevel(allText);
                const recommendedTests = recommendTestsAfterInterview(theme, allText, riskLevel);
                const assessmentPurpose = buildAssessmentPurpose(theme, allText, riskLevel);
                const scores = getMindScores(allText, riskLevel);
                const keywords = extractKeywords(allText, theme);
                const strengths = inferStrengths(allText, theme);
                const smallPractice = getSmallPractice(theme);

                const concernText = cleanReportSentence(mainConcern, "지금 마음을 이해하고 싶다는 바람");
                const feelingText = cleanReportSentence(feltSense, "마음속 부담과 피로");
                const storyText = cleanReportSentence(story);
                const innerText = cleanReportSentence(innerSentence);
                const impactText = cleanReportSentence(impact);
                const copingText = cleanReportSentence(coping);

                const lineByTheme = {
                    parenting: "아이를 잘 돌보고 싶은 마음만큼, 부모님의 마음에도 돌봄과 쉼이 필요합니다.",
                    couple: "관계를 지키려는 마음 뒤에서, 이해받고 싶은 마음도 오래 기다리고 있습니다.",
                    work: "계속 해내려는 책임감 뒤에서, 마음은 잠시 멈추어 숨을 고르고 싶어 합니다.",
                    emotion: "버티려는 마음과 쉬고 싶은 마음이 함께 있다는 것을 알아차릴 때 회복이 시작됩니다.",
                    relationship: "관계를 잃지 않으려 애써온 만큼, 내 마음의 자리도 함께 지켜줄 필요가 있습니다.",
                    self: "답을 서둘러 찾기보다 지금 마음이 보내는 신호를 알아차리는 것이 먼저입니다."
                };
                const mindLine = lineByTheme[theme.type] || lineByTheme.self;

                const awarenessParts = [
                    `이번 대화에서 가장 중심에 놓여 있던 이야기는 “${concernText}”였습니다. 그 말에는 단순한 상황 설명을 넘어, 지금의 마음을 누군가가 제대로 알아주었으면 하는 바람이 함께 담겨 있는 것으로 느껴집니다.`,
                    `대화 속에서 드러난 ${feelingText}은 한순간 생긴 감정이라기보다, 해결해야 할 일과 감당해야 할 마음이 겹치면서 조금씩 쌓여온 신호로 이해할 수 있습니다.${storyText ? ` 특히 “${storyText}”라는 경험은 마음의 부담이 커지는 중요한 장면으로 보입니다.` : ""}`,
                    `${innerText ? `마음속에 “${innerText}”와 같은 문장이 반복되고 있다면, 그 문장은 현재의 어려움을 이해하는 중요한 단서입니다. ` : ""}사람은 힘든 상황이 이어질수록 감정을 충분히 느끼고 표현하기보다 먼저 버티거나 해결하려는 쪽으로 움직이기 쉽습니다. 그 과정에서 자신의 피로와 서운함, 두려움은 뒤로 밀릴 수 있습니다.`,
                    `${impactText ? `또한 “${impactText}”라고 표현한 부분을 보면 지금의 마음이 일상에도 어느 정도 영향을 주고 있음을 살펴볼 필요가 있습니다. ` : ""}현재의 반응은 마음이 약해서 생긴 문제가 아니라, 오래 긴장하고 애써온 마음이 이제는 자신을 돌아봐 달라고 보내는 자연스러운 신호일 수 있습니다.`
                ];
                const awareness = awarenessParts.join("\n\n");

                const connectionParts = [
                    `지금까지의 이야기를 보면, 힘든 마음 속에서도 상황을 이해하고 정리해 보려는 힘이 분명히 남아 있습니다. 자신의 상태를 말로 표현하고 도움을 찾으려 한 것 자체가 이미 중요한 변화의 시작입니다.`,
                    `마음은 감정을 억지로 없앨 때보다, 왜 이런 감정이 생겼는지 안전하게 알아차릴 때 조금씩 안정됩니다. 해결해야 할 문제만 바라보면 마음은 계속 긴장하지만, 그 안에 있는 서운함·불안·피로·바람을 구분해 바라보면 내가 무엇을 필요로 하는지도 더 선명해질 수 있습니다.`,
                    `${copingText ? `지금까지 “${copingText}”와 같은 방식으로 견뎌오셨다면, 그것은 그동안 자신을 지키기 위해 선택한 나름의 대처였을 것입니다. ` : ""}다만 익숙한 대처가 지금도 나를 돕고 있는지, 오히려 더 지치게 하고 있는지는 천천히 구분해 볼 필요가 있습니다.`,
                    `오늘은 모든 문제를 한꺼번에 해결하려 하기보다, 가장 크게 느껴지는 감정 하나에 이름을 붙여 보세요. 그리고 “이 마음은 지금 나에게 무엇이 필요하다고 말하고 있을까?”라고 조용히 물어보는 것부터 시작해도 좋습니다. 작은 알아차림은 마음을 바꾸라고 재촉하는 것이 아니라, 지금의 나를 이해하고 다음 방향을 선택할 수 있게 해주는 첫걸음입니다.`
                ];
                const mindConnection = connectionParts.join("\n\n");

                const guide = riskLevel === "높음"
                    ? "현재 안전 확인이 우선적으로 필요해 보입니다. 지금 당장 스스로를 해칠 위험이 있거나 혼자 있기 어렵다면 112, 119, 자살예방상담전화 109 또는 가까운 응급실의 도움을 즉시 요청해 주세요."
                    : "이 마음체크리포트는 대화를 바탕으로 현재 마음을 이해하기 쉽게 정리한 참고자료이며, 진단이나 심리평가 결과가 아닙니다.";

                const summary = "주호소: " + (mainConcern || "추가 확인 필요") + "\n" +
                    "주요 주제: " + theme.label + "\n" +
                    "감정/몸의 신호: " + (feltSense || "추가 확인 필요") + "\n" +
                    "마음이 커지는 장면: " + (story || "추가 확인 필요") + "\n" +
                    "마음속 반복 문장: " + (innerSentence || "추가 확인 필요") + "\n" +
                    "지속 기간: " + (duration || "추가 확인 필요") + "\n" +
                    "일상 영향: " + (impact || "추가 확인 필요") + "\n" +
                    "현재 대처 방식: " + (coping || "추가 확인 필요") + "\n" +
                    "상담 목표: " + (goal || "추가 확인 필요") + "\n" +
                    "위험도: " + riskLevel;

                return {
                    id: Date.now(),
                    name: aiIntakeUser.name,
                    phone: aiIntakeUser.phone,
                    email: aiIntakeUser.email,
                    date: new Date().toLocaleString(),
                    mainConcern,
                    feltSense,
                    story,
                    innerSentence,
                    duration,
                    impact,
                    coping,
                    goal,
                    riskText: risk,
                    riskLevel,
                    theme,
                    assessmentPurpose,
                    recommendedTests,
                    counselorBriefing: {
                        mainConcern,
                        currentEmotion: feltSense,
                        coreEvent: story,
                        duration,
                        impact,
                        coping,
                        expectation: goal,
                        strengths,
                        assessmentPurpose,
                        recommendedTests,
                        preparationQuestions: ["오늘 가장 먼저 다루고 싶은 주제를 확인하기", "최근 생활 리듬과 수면 변화 확인하기", "나에게 도움이 될 수 있는 심리검사의 필요성에 대한 내담자 동의 확인하기"]
                    },
                    scores,
                    keywords,
                    strengths,
                    counselingRecommendation: theme.program,
                    smallPractice,
                    mindLine,
                    awareness,
                    mindConnection,
                    // 이전 저장 데이터와의 호환을 위한 필드
                    empathy: awareness,
                    mindReflection: mindConnection,
                    rememberMessage: mindLine,
                    guide,
                    summary,
                    status: "AI상담완료",
                    messages
                };
            };

            const saveAiIntakeSummary = (report) => {
                const saved = JSON.parse(localStorage.getItem("modumam_intake_summaries") || "[]");
                const updated = [report, ...saved];
                localStorage.setItem("modumam_intake_summaries", JSON.stringify(updated));
                setIntakeSummaries(updated);
            };

            /* =====================================================
               [MOD-20260710-027] AI 마음상담 기록 삭제
               - AI 마음리포트 기록 삭제
               - AI 마음체크 기록 삭제
               - 삭제 전 확인창 표시
               - Local Storage와 화면을 동시에 갱신
            ===================================================== */
            const deleteMindReportRecord = (id) => {
                if (!window.confirm('이 AI 마음리포트 기록을 삭제하시겠습니까?')) return;

                const updated = mindRecords.filter((record) => record.id !== id);
                setMindRecords(updated);
                localStorage.setItem(getMindReportStorageKey(), JSON.stringify(updated));
            };

            const deleteAiIntakeRecord = (id) => {
                if (!window.confirm('이 AI 마음체크 기록을 삭제하시겠습니까?')) return;

                const updated = intakeSummaries.filter((record) => record.id !== id);
                setIntakeSummaries(updated);
                localStorage.setItem('modumam_intake_summaries', JSON.stringify(updated));
            };

            const buildSilenceFollowUp = (messages) => {
                // v23 Stable: 자동 고정 질문은 사용하지 않습니다.
                // 침묵 후 질문도 AI가 대화 맥락을 보고 생성해야 하므로 로컬 템플릿을 비활성화합니다.
                return null;
            };

            const startSilenceTimer = (messages) => {
                // v22 HotFix: 자동 고정 질문이 대화 흐름을 끊어 반복 응답처럼 보이는 문제를 막기 위해 비활성화합니다.
                if (window.modumamSilenceTimer) {
                    clearTimeout(window.modumamSilenceTimer);
                    window.modumamSilenceTimer = null;
                }
                return;
            };



           const getLocalMindChatReply = (lastText, messages = []) => {
                // v28 수정: AI 함수 오류 시 기계적인 상담문을 만들지 않고, 짧은 재시도 안내만 표시합니다.
                const allText = messages.map((m) => String(m.text || '')).join(' ');

                if (/자살|죽고\s*싶|죽고싶|자해|해치고|사라지고\s*싶|끝내고\s*싶|극단|목숨|유서/.test(allText)) {
                    return "지금은 안전이 가장 중요합니다.\n\n스스로를 해치고 싶거나 당장 안전하지 않다고 느껴진다면, 지금 바로 112, 119, 자살예방상담전화 109 또는 가까운 응급실의 도움을 받아 주세요.\n\n가능하다면 지금 혼자 있지 말고, 곁에 연락할 수 있는 사람에게 바로 알려 주세요.";
                }

                return "방금 답변을 안정적으로 완성하지 못했습니다.\n\n같은 내용을 한 번만 다시 보내주시면, 이어서 조심스럽게 듣겠습니다.";
            };

            const handleAiIntakeSend = async () => {
                if (window.modumamSilenceTimer) {
                    clearTimeout(window.modumamSilenceTimer);
                    window.modumamSilenceTimer = null;
                }

                if (!aiIntakeInput.trim()) return;

                const pendingInput = aiIntakeInput.trim();

                // [MOD-20260712-SESSION-END] 종료 안내 이후에는 Y만 리포트 확인 명령으로 처리합니다.
                if (aiIntakeSessionPhase === "awaiting-report") {
                    const yInput = /^[yY]$/.test(pendingInput);
                    const userMessage = { role: "user", text: pendingInput, time: getChatTime() };
                    setAiIntakeInput("");

                    if (!yInput) {
                        setAiIntakeMessages((prev) => [
                            ...prev,
                            userMessage,
                            {
                                role: "ai",
                                text: `AI 마음체크 시간이 종료되어 더 이상 대화를 이어갈 수 없습니다.

AI 마음체크리포트를 확인하시려면 Y를 입력해 주세요.`,
                                time: getChatTime(),
                                noticeType: "y-required"
                            }
                        ]);
                        return;
                    }

                    if (aiIntakeEndTimerRef.current) {
                        clearTimeout(aiIntakeEndTimerRef.current);
                        aiIntakeEndTimerRef.current = null;
                    }

                    const completedMessages = [...aiIntakeMessages, userMessage];
                    setAiIntakeMessages(completedMessages);
                    setIsAiIntakeThinking(true);
                    setAiIntakeSessionPhase("ended");

                    setTimeout(() => {
                        const report = createAiMindReport(completedMessages);
                        saveAiIntakeSummary(report);
                        setAiIntakeReport(report);
                        setIsAiIntakeThinking(false);
                    }, 700);
                    return;
                }

                if (aiIntakeSessionPhase === "ended") return;

                if (!aiIntakeUser.privacyAgree) {
                    alert("개인정보 수집 및 AI 마음상담 이용에 동의해 주세요");
                    return;
                }

                const userText = pendingInput;
                const nextMessages = [...aiIntakeMessages, { role: "user", text: userText, time: getChatTime() }];
                setAiIntakeMessages(nextMessages);
                setAiIntakeInput("");
                setIsAiIntakeThinking(true);
                const nextStep = aiIntakeStep + 1;

                if (true) {
                    try {
                        const response = await fetch("/.netlify/functions/gemini-intake", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                messages: nextMessages,
                                sessionStart: aiIntakeSessionStart || Date.now(),
                                abuseWarningCount: aiIntakeAbuseWarningCount || 0
                            })
                        });

                        const result = await response.json();
                        console.log("[MODUMAM AI CHECKIN]", {
                            function: "/.netlify/functions/gemini-intake",
                            promptVersion: result.promptVersion || "unknown",
                            input: userText,
                            isComplete: !!result.isComplete
                        });
                        if (!response.ok) throw new Error(result.error || "AI 연결 오류");

                        if (typeof result.abuseWarningCount === "number") {
                            setAiIntakeAbuseWarningCount(result.abuseWarningCount);
                        }

                        let replyText = String(result.text || "").trim();
                        if (!replyText) {
                            replyText = getLocalMindChatReply(userText, nextMessages);
                        }

                        // 10분 종료 안내가 먼저 표시된 경우, 늦게 도착한 상담 답변은 추가하지 않습니다.
                        if (aiIntakeSessionPhaseRef.current !== "active") {
                            setIsAiIntakeThinking(false);
                            return;
                        }

                        const aiReply = { role: "ai", text: replyText, time: getChatTime() };
                        const updatedMessages = [...nextMessages, aiReply];

                        setAiIntakeMessages(updatedMessages);
                        setIsAiIntakeThinking(false);

                        // 리포트는 10분 종료 안내 후 사용자가 Y를 입력한 경우에만 생성합니다.
                        if (aiIntakeSessionPhaseRef.current === "active") {
                            startSilenceTimer(updatedMessages);
                        }

                        setAiIntakeStep(nextStep);
                        return;
                    } catch (error) {
                        console.warn("[MODUMAM AI CHECKIN] function failed", error);
                        if (aiIntakeSessionPhaseRef.current === "active") {
                            const errorText = getLocalMindChatReply(userText, nextMessages);
                            setAiIntakeMessages([...nextMessages, { role: "ai", text: errorText, time: getChatTime() }]);
                        }
                        setIsAiIntakeThinking(false);
                        return;
                    }
                }

                const completedMessages = [
                    ...nextMessages,
                    {
                        role: "ai",
                        time: getChatTime(),
                        text: "끝까지 이야기해 주셔서 감사합니다.\n\n지금까지 나눠주신 내용을 바탕으로 마음의 신호를 조심스럽게 정리해볼게요.\n\n심리검사는 질문마다 추천하지 않고, 전체 대화를 상담적으로 정리한 뒤 마지막에 필요한 검사와 그 이유를 안내드리겠습니다."
                    }
                ];

                const report = createAiMindReport(completedMessages);
                saveAiIntakeSummary(report);
                setAiIntakeMessages(completedMessages);
                setAiIntakeReport(report);
                setAiIntakeInput("");
            };

            const goToReservationFromAiReport = () => {
                if (aiIntakeReport?.counselingRecommendation) {
                    if (aiIntakeReport.counselingRecommendation.includes("부모-자녀")) {
                        setBookingProgram("부모-자녀 마음이음");
                        setBookingType("찾아가는(대면)");
                    } else if (aiIntakeReport.counselingRecommendation.includes("부부")) {
                        setBookingProgram("부부 마음이음");
                    } else {
                        setBookingProgram("개인 마음이음");
                    }

                    const extraTests = (aiIntakeReport.recommendedTests || [])
                        .map((item) => item.name || item)
                        .filter((name) => !String(name).includes("TCI") && !String(name).includes("PAT") && !String(name).includes("KCDI"))
                        .map((name) => {
                            if (String(name).includes("SCT")) return "문장완성검사(무료)";
                            if (String(name).includes("MMPI")) return "다면적 인성검사";
                            if (String(name).includes("STS")) return "영유아·청소년 기질성격검사";
                            return name;
                        });

                    setSelectedTests([...new Set(extraTests)]);
                    setBookingName(aiIntakeReport.name || "");
                    setBookingPhone(aiIntakeReport.phone || "");
                }

                setIsAiIntakeOpen(false);
                setTimeout(() => scrollToSection("reservations"), 100);
            };

            const copyAiReportForUser = () => {
                if (!aiIntakeReport) return;

                const testText = (aiIntakeReport.recommendedTests || [])
                    .map((test) => "- " + test.name + ": " + test.reason)
                    .join("\n");

                const keywordText = (aiIntakeReport.keywords || []).map((t) => "- " + t).join("\n");
                const strengthText = (aiIntakeReport.strengths || []).map((t) => "- " + t).join("\n");

                const text = "[모두의 마음연구소 AI 마음체크리포트]\n\n" +
                    "[마음 한줄]\n" + (aiIntakeReport.mindLine || aiIntakeReport.rememberMessage || "") + "\n\n" +
                    "[알아차림]\n" + (aiIntakeReport.awareness || aiIntakeReport.empathy || "") + "\n\n" +
                    "[마음 연결]\n" + (aiIntakeReport.mindConnection || aiIntakeReport.mindReflection || "") + "\n\n" +
                    "[나에게 도움이 될 수 있는 심리검사와 이유]\n" + (testText || "현재 대화만으로 별도의 검사를 권하기보다 마음의 변화를 조금 더 살펴보는 것이 좋겠습니다.") + "\n\n" +
                    "[안내]\n" + aiIntakeReport.guide + "\n\n" +
                    "※ 본 리포트는 진단이나 심리평가 결과가 아니라, 대화를 바탕으로 현재 마음을 이해하기 쉽게 정리한 참고자료입니다.";

                navigator.clipboard.writeText(text);
                alert("상담자용 브리핑이 복사되었습니다.");
            };



            /* =====================================================
               [V38] AI 결과상담 예약·보고서 연결
            ===================================================== */
            const getApprovedReportsForCurrentUser = () => {
                let reports = [];
                try {
                    reports = JSON.parse(localStorage.getItem("modumam_reports") || "[]");
                } catch (e) {
                    reports = [];
                }

                return reports
                    .filter((report) => {
                        const reportName = String(report.clientName || "").trim();
                        const reportPhone = String(report.phone || "").replace(/[^0-9]/g, "");
                        const nameMatch = currentName && reportName === currentName;
                        const phoneMatch = currentPhone && reportPhone &&
                            (reportPhone.endsWith(currentPhone) || currentPhone.endsWith(reportPhone));
                        return report.approvedForClient === true && (nameMatch || phoneMatch);
                    })
                    .sort((a, b) => {
                        const aIntegrated = a.assessmentReport === true || /종합\s*심리평가|종합보고서/.test(String(a.testType || a.title || ""));
                        const bIntegrated = b.assessmentReport === true || /종합\s*심리평가|종합보고서/.test(String(b.testType || b.title || ""));
                        if (aIntegrated !== bIntegrated) return aIntegrated ? -1 : 1;
                        const aTime = Number(a.id || 0);
                        const bTime = Number(b.id || 0);
                        return bTime - aTime;
                    });
            };

            /* [MOD-20260713-ADMIN-RESULT-LINK-V2]
               관리자 공개 검사결과를 회원 마이페이지에 연결
               - 이름/전화번호 표기 차이를 정규화
               - 회원 예약 ID까지 함께 비교해 동일 회원 결과를 안정적으로 찾음
            */
            const getVisibleResultUploadsForCurrentUser = () => {
                let uploads = [];
                let savedReservations = [];
                try {
                    uploads = JSON.parse(localStorage.getItem("modumam_test_result_uploads") || "[]");
                    savedReservations = JSON.parse(localStorage.getItem("modumam_reservations") || "[]");
                } catch (e) {
                    uploads = [];
                    savedReservations = [];
                }

                const normalizeName = (value) =>
                    String(value || "").replace(/\s+/g, "").toLowerCase();
                const normalizePhone = (value) =>
                    String(value || "").replace(/[^0-9]/g, "");

                const loginName = normalizeName(currentName);
                const loginPhone = normalizePhone(currentPhone);
                const myReservationIds = new Set(
                    savedReservations
                        .filter((reservation) => {
                            const reservationName = normalizeName(reservation.name);
                            const reservationPhone = normalizePhone(reservation.phone);
                            const nameMatch = !!loginName && reservationName === loginName;
                            const phoneMatch = !!loginPhone && !!reservationPhone &&
                                (reservationPhone === loginPhone ||
                                 reservationPhone.endsWith(loginPhone) ||
                                 loginPhone.endsWith(reservationPhone));
                            return nameMatch || phoneMatch;
                        })
                        .map((reservation) => String(reservation.id))
                );

                return uploads.filter((item) => {
                    if (item.visibleToClient !== true) return false;

                    const itemName = normalizeName(item.clientName || item.name);
                    const itemPhone = normalizePhone(item.phone);
                    const nameMatch = !!loginName && itemName === loginName;
                    const phoneMatch = !!loginPhone && !!itemPhone &&
                        (itemPhone === loginPhone ||
                         itemPhone.endsWith(loginPhone) ||
                         loginPhone.endsWith(itemPhone));
                    const reservationMatch = item.reservationId != null &&
                        myReservationIds.has(String(item.reservationId));

                    return nameMatch || phoneMatch || reservationMatch;
                });
            };

            const openUploadedResult = (upload) => {
                if (!upload?.dataUrl) {
                    alert("검사결과 파일을 찾을 수 없습니다. 관리자에게 문의해 주세요.");
                    return;
                }
                const win = window.open();
                if (win) {
                    win.location.href = upload.dataUrl;
                } else {
                    alert("팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.");
                }
            };

            const getAiReservationWindow = (reservation) => {
                if (!reservation?.date || !reservation?.time) return null;
                const start = new Date(`${reservation.date}T${reservation.time}:00`);
                if (Number.isNaN(start.getTime())) return null;
                const end = new Date(start.getTime() + 50 * 60 * 1000);
                return { start, end };
            };

            const getAiReservationState = (reservation) => {
                const windowInfo = getAiReservationWindow(reservation);
                if (!windowInfo) return { status: "invalid", remainingMs: 0 };

                const now = aiResultNow;
                if (now < windowInfo.start.getTime()) {
                    return {
                        status: "before",
                        remainingMs: windowInfo.start.getTime() - now,
                        start: windowInfo.start,
                        end: windowInfo.end
                    };
                }
                if (now >= windowInfo.end.getTime()) {
                    return {
                        status: "ended",
                        remainingMs: 0,
                        start: windowInfo.start,
                        end: windowInfo.end
                    };
                }
                return {
                    status: "available",
                    remainingMs: windowInfo.end.getTime() - now,
                    start: windowInfo.start,
                    end: windowInfo.end
                };
            };

            const formatRemainingTime = (ms) => {
                const total = Math.max(0, Math.floor(ms / 1000));
                const minutes = Math.floor(total / 60);
                const seconds = total % 60;
                return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            };

            const reportToCounselingContext = (report) => {
                if (!report) return "";
                const fields = [
                    ["보고서 제목", report.title],
                    ["보고서 유형", report.assessmentReport ? "내담자 제공용 종합 심리평가 보고서" : report.testType],
                    ["실시 검사", Array.isArray(report.tests) ? report.tests.join(", ") : ""],
                    ["종합 요약", report.summary],
                    ["강점과 보호요인", report.strength || report.strengths],
                    ["어려움을 느낄 수 있는 부분", report.caution || report.concerns],
                    ["일상 및 상담 제안", report.plan || report.recommendation],
                    ["전문가 소견", report.clinicalOpinion],
                    ["전체 결과", report.resultText || report.reportText || report.content]
                ];

                const base = fields
                    .filter(([, value]) => value)
                    .map(([label, value]) => `${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
                    .join("\n\n");

                return base || JSON.stringify(report);
            };

            const callAiResultCounseling = async ({ mode, report, messages }) => {
                const response = await fetch("/.netlify/functions/result-counseling", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mode,
                        reportText: reportToCounselingContext(report),
                        messages,
                        reservation: activeAiReservation
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "AI 결과상담 연결 오류");
                return String(data.text || "").trim();
            };

            const startAiResultCounseling = async (reservation) => {
                const state = getAiReservationState(reservation);
                const approvedReports = getApprovedReportsForCurrentUser();

                if (reservation?.aiResultCounselingEnabled !== true) {
                    alert("관리자가 AI 결과상담을 활성화한 뒤 이용할 수 있습니다.");
                    return;
                }
                if (reservation?.aiResultCounselingCompletedAt) {
                    alert("이 예약의 AI 결과상담은 이미 완료되었습니다.");
                    return;
                }
                if (state.status === "before") {
                    alert(`예약시간이 되면 AI 결과상담 버튼이 활성화됩니다.\n상담시간: ${reservation.date} ${reservation.time}부터 50분`);
                    return;
                }
                if (state.status === "ended") {
                    alert("예약된 AI 결과상담 시간이 종료되었습니다.");
                    return;
                }
                if (!approvedReports.length) {
                    alert("임상심리사가 검토·승인한 결과보고서가 있어야 AI 결과상담을 시작할 수 있습니다.");
                    return;
                }

                const report = approvedReports.find((item) =>
                    String(item.reservationId || "") === String(reservation?.id || "") &&
                    (item.assessmentReport === true || /종합\s*심리평가|종합보고서/.test(String(item.testType || item.title || "")))
                ) || approvedReports.find((item) =>
                    String(item.reservationId || "") === String(reservation?.id || "")
                ) || approvedReports[0];
                setActiveAiReservation(reservation);
                setActiveApprovedReport(report);
                setAiResultCounselingOpen(true);
                setAiResultThinking(true);
                setAiResultSummary("");

                const intro = {
                    role: "ai",
                    text: "임상심리사가 검토·승인한 결과보고서를 불러왔습니다. 먼저 전체 결과를 차분히 살펴본 뒤 상담을 시작하겠습니다.",
                    time: getChatTime()
                };
                setAiResultMessages([intro]);

                try {
                    const overview = await callAiResultCounseling({
                        mode: "overview",
                        report,
                        messages: []
                    });
                    setAiResultMessages([
                        intro,
                        { role: "ai", text: overview, time: getChatTime() }
                    ]);
                } catch (error) {
                    setAiResultMessages([
                        intro,
                        {
                            role: "ai",
                            text: "결과보고서에서는 현재의 어려움뿐 아니라 강점과 회복 가능성도 함께 살펴볼 수 있습니다. 가장 궁금했던 부분부터 말씀해 주시면 보고서 내용과 실제 경험을 연결해 함께 살펴보겠습니다.",
                            time: getChatTime()
                        }
                    ]);
                } finally {
                    setAiResultThinking(false);
                }
            };

            const sendAiResultMessage = async () => {
                const value = aiResultInput.trim();
                if (!value || aiResultThinking || !activeAiReservation || !activeApprovedReport) return;

                const state = getAiReservationState(activeAiReservation);
                if (state.status !== "available") {
                    await finishAiResultCounseling();
                    return;
                }

                const userMessage = { role: "user", text: value, time: getChatTime() };
                const nextMessages = [...aiResultMessages, userMessage];
                setAiResultMessages(nextMessages);
                setAiResultInput("");
                setAiResultThinking(true);

                try {
                    const reply = await callAiResultCounseling({
                        mode: "chat",
                        report: activeApprovedReport,
                        messages: nextMessages
                    });
                    setAiResultMessages([
                        ...nextMessages,
                        { role: "ai", text: reply, time: getChatTime() }
                    ]);
                } catch (error) {
                    setAiResultMessages([
                        ...nextMessages,
                        {
                            role: "ai",
                            text: "결과보고서와 지금 말씀해 주신 경험을 함께 보면, 한 가지 의미로 단정하기보다 실제 상황에서 어떻게 나타나는지 살펴보는 것이 중요합니다. 그 부분이 가장 두드러지는 장면을 조금 더 이야기해 주세요.",
                            time: getChatTime()
                        }
                    ]);
                } finally {
                    setAiResultThinking(false);
                }
            };

            const finishAiResultCounseling = async () => {
                if (!activeAiReservation || aiResultThinking) return;
                setAiResultThinking(true);

                let summary = "";
                try {
                    summary = await callAiResultCounseling({
                        mode: "summary",
                        report: activeApprovedReport,
                        messages: aiResultMessages
                    });
                } catch (error) {
                    summary = "오늘은 결과보고서의 의미를 실제 경험과 연결해 살펴보았습니다. 검사결과는 자신을 단정하는 결론이 아니라, 현재의 마음과 반복되는 반응을 이해하기 위한 자료입니다. 오늘 새롭게 이해한 부분을 이후 전문가 상담에서도 이어서 살펴보시기 바랍니다.";
                }

                setAiResultSummary(summary);
                setAiResultThinking(false);

                try {
                    const saved = JSON.parse(localStorage.getItem("modumam_ai_result_counseling_records") || "[]");
                    const record = {
                        id: Date.now(),
                        reservationId: activeAiReservation.id,
                        clientName: currentName || activeAiReservation.name || "",
                        phone: currentPhone || activeAiReservation.phone || "",
                        reportId: activeApprovedReport?.id || null,
                        reportTitle: activeApprovedReport?.title || "종합 심리평가 보고서",
                        reportType: activeApprovedReport?.assessmentReport ? "종합 심리평가" : (activeApprovedReport?.testType || "결과보고서"),
                        startedAt: aiResultMessages?.[0]?.time || "",
                        completedAt: new Date().toLocaleString("ko-KR"),
                        date: new Date().toLocaleString("ko-KR"),
                        summary,
                        messages: aiResultMessages,
                        messageCount: aiResultMessages.length,
                        counselorReviewRequired: true
                    };
                    localStorage.setItem(
                        "modumam_ai_result_counseling_records",
                        JSON.stringify([record, ...saved])
                    );

                    const currentReservations = JSON.parse(localStorage.getItem("modumam_reservations") || "[]");
                    const completedAt = new Date().toLocaleString("ko-KR");
                    const updatedReservations = currentReservations.map((item) =>
                        String(item.id) === String(activeAiReservation.id)
                            ? {
                                ...item,
                                aiResultCounselingCompletedAt: completedAt,
                                aiResultCounselingSummary: summary,
                                status: String(item.type || "").includes("AI") ? "상담완료" : item.status
                            }
                            : item
                    );
                    localStorage.setItem("modumam_reservations", JSON.stringify(updatedReservations));
                    setReservations(updatedReservations);
                    setActiveAiReservation((prev) => prev ? { ...prev, aiResultCounselingCompletedAt: completedAt } : prev);
                } catch (e) {}
            };

            const checkApprovedResult = () => {
                const name = document.getElementById("resultName")?.value?.trim() || "";
                const phone = (document.getElementById("resultPhone")?.value || "").replace(/[^0-9]/g, "");
                const area = document.getElementById("resultViewArea");

                if (!area) return;

                if (!name || phone.length < 4) {
                    area.innerHTML = '<div class="mt-6 bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl p-5 text-sm font-bold">이름과 연락처 뒤 4자리 이상을 입력해 주세요.</div>';
                    return;
                }

                let reports = [];
                try {
                    reports = JSON.parse(localStorage.getItem("modumam_reports") || "[]");
                } catch (e) {
                    reports = [];
                }

                const safe = (value) => String(value || "")
                    .replaceAll("&", "&amp;")
                    .replaceAll("<", "&lt;")
                    .replaceAll(">", "&gt;");

                const matched = reports.filter((report) => {
                    const reportName = String(report.clientName || "").trim();
                    const reportPhone = String(report.phone || "").replace(/[^0-9]/g, "");
                    const nameMatch = reportName === name;
                    const phoneMatch = reportPhone && (reportPhone.endsWith(phone) || phone.endsWith(reportPhone));
                    const approved = report.approvedForClient === true;
                    return nameMatch && phoneMatch && approved;
                });

                if (!matched.length) {
                    area.innerHTML = `
                        <div class="mt-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl p-5 text-sm font-bold">
                            승인된 결과보고서를 찾을 수 없습니다. 이름과 연락처를 다시 확인하거나, 관리자에게 결과 승인 여부를 문의해 주세요.
                        </div>
                    `;
                    return;
                }

                area.innerHTML = `
                    <div class="mt-8 space-y-5">
                        <div class="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm font-bold">
                            확인 가능한 결과보고서 ${matched.length}건이 있습니다.
                        </div>
                        ${matched.map((report) => `
                            <article class="bg-white border border-slate-100 rounded-[2rem] p-6 sm:p-8 shadow-sm">
                                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                                    <div>
                                        <p class="text-xs font-bold text-emerald-700 mb-2">MODUMAM LAB REPORT</p>
                                        <h2 class="text-2xl font-extrabold text-slate-900">${safe(report.title || "결과보고서")}</h2>
                                        <p class="text-sm text-slate-500 mt-2">
                                            ${safe(report.clientName)} · ${safe(report.testType)} · ${safe(report.createdAt)}
                                        </p>
                                    </div>
                                    <span class="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-4 py-2 text-xs font-bold">
                                        승인 완료
                                    </span>
                                </div>

                                <div class="grid grid-cols-1 gap-4">
                                    <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                        <h3 class="text-sm font-extrabold text-slate-900 mb-2">종합 소견</h3>
                                        <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">${safe(report.summary)}</p>
                                    </div>
                                    <div class="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                                        <h3 class="text-sm font-extrabold text-emerald-800 mb-2">강점 및 자원</h3>
                                        <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">${safe(report.strength)}</p>
                                    </div>
                                    <div class="bg-amber-50 rounded-2xl p-5 border border-amber-100">
                                        <h3 class="text-sm font-extrabold text-amber-800 mb-2">주의점 및 어려움</h3>
                                        <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">${safe(report.caution)}</p>
                                    </div>
                                    <div class="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
                                        <h3 class="text-sm font-extrabold text-indigo-800 mb-2">상담 계획 및 제안</h3>
                                        <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">${safe(report.plan)}</p>
                                    </div>
                                </div>

                                <p class="text-xs text-slate-400 mt-6 leading-relaxed">
                                    본 보고서는 자기이해와 상담을 돕기 위한 참고자료이며, 의학적 진단을 대신하지 않습니다.
                                    최종 해석과 상담계획은 전문가 상담을 통해 확인해 주세요.
                                </p>
                            </article>
                        `).join("")}
                    </div>
                `;
            };

            // Quick Scroll helpers
            const scrollToSection = (id) => {
                const element = document.getElementById(id);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            };

            /* =====================================================
               [MOD-20260710-001] 마이페이지 접근 안내
               - 마이페이지는 결제 여부가 아니라 로그인 여부로 접근을 판단합니다.
               - 회원이면 누구나 마이페이지로 이동할 수 있습니다.
               - 마음기록/결과확인은 기존처럼 신청·결제 후 열립니다.
            ===================================================== */
            const handleMyPageClick = () => {
                let savedUser = null;
                try {
                    savedUser = JSON.parse(localStorage.getItem('modumamUser') || 'null');
                } catch (e) {
                    savedUser = null;
                }

                if (!isLoggedIn && !savedUser) {
                    setAuthMode('login');
                    setIsAuthModalOpen(true);
                    return;
                }

                scrollToSection('mypage');
            };

            /* =====================================================
               [MOD-v1.1.0-001] 로그아웃 처리
               - 저장된 회원 정보를 삭제하고 화면을 비회원 상태로 되돌립니다.
               - AI 마음체크 창과 모바일 메뉴를 함께 닫습니다.
            ===================================================== */
            const handleLogout = () => {
                localStorage.removeItem('modumamUser');
                setIsLoggedIn(false);
                setAuthForm({ name: '', phone: '', email: '', password: '' });
                setIsMobileMenuOpen(false);
                setIsAiIntakeOpen(false);
                setAiIntakeReport(null);
                alert('로그아웃되었습니다.');
                setTimeout(() => scrollToSection('home'), 80);
            };

            const openAdminLogin = () => {
                // 홈페이지에는 관리자 버튼을 노출하지 않습니다.
                // 필요 시 주소창에 /admin/index.html 직접 입력하여 접속합니다.
                window.location.href = './admin/index.html';
            };

            const submitAdminLogin = (e) => {
                e.preventDefault();
                if (adminPassword === "modumam2026") {
                    setIsAdmin(true);
                    window.location.href = './admin/index.html';
                    setIsAdminLoginOpen(false);
                    setAdminPassword('');
                    setAdminLoginError('');
                    return;
                }
                setAdminLoginError("비밀번호가 맞지 않습니다.");
            };

            useEffect(() => {
                const checkAdminHash = () => {
                    if (window.location.hash === '#modumam-admin') {
                        openAdminLogin();
                    }
                };
                checkAdminHash();
                window.addEventListener('hashchange', checkAdminHash);
                return () => window.removeEventListener('hashchange', checkAdminHash);
            }, []);

         const recommendationMap = {
  teen: {
    character: [
      "JTCI (마음사랑)",
      "STS 성격강점검사 (인싸이트)"
    ],
    emotion: [
      "JTCI (마음사랑)",
      "MMPI-A (마음사랑)",
      "PAI-A 청소년성격평가 (인싸이트)"
    ],
    relationship: [
      "JTCI (마음사랑)",
      "K-IIP 대인관계문제 (인싸이트)",
      "SCT/HTP (인싸이트)"
    ],
    meaning: [
      "JTCI (마음사랑)",
      "GOLDEN 골든성격유형 (인싸이트)",
      "SCT 문장완성 (인싸이트)"
    ],
    resilience: [
      "청소년 회복탄력성 검사 (인싸이트)"
    ],
    career: [
      "CAD 주의집중력검사 (인싸이트)",
      "Holland 진로발달검사 (인싸이트)"
    ]
  },
  adult: {
    character: [
      "TCI (마음사랑)",
      "STS 성격강점검사 (인싸이트)"
    ],
    emotion: [
      "TCI (마음사랑)",
      "MMPI-2 (마음사랑)",
      "PAI 성격평가질문지 (인싸이트)"
    ],
    relationship: [
      "TCI (마음사랑)",
      "K-IIP 대인관계문제 (인싸이트)",
      "SCT/HTP (인싸이트)"
    ],
    meaning: [
      "TCI (마음사랑)",
      "GOLDEN 골든성격유형 (인싸이트)",
      "SCT 문장완성 (인싸이트)"
    ],
    resilience: [
      "성인 회복탄력성 검사 (인싸이트)"
    ]
  },
  parent: {
    development: [
      "PAT 부모양육태도검사 (인싸이트)",
      "KCDI 아동발달검사 (인싸이트)"
    ],
    character: [
      "TCI (마음사랑)",
      "STS 성격강점검사 (인싸이트)"
    ],
    emotion: [
      "TCI (마음사랑)",
      "MMPI-2 (마음사랑)",
      "PAI 양육태도검사 (인싸이트)"
    ],
    relationship: [
      "TCI (마음사랑)",
      "K-IIP 대인관계문제 (인싸이트)",
      "SCT/HTP (인싸이트)"
    ]
  }
};

const recommendedTests = recommendationMap[userAge]?.[userWorry] || [];

/* =====================================================
   추천 검사 설명 팝업 내용
   - 추천 검사 조합에서 검사명을 클릭하면 이 설명이 팝업으로 표시됩니다.
   - 사용자 화면은 쉬운 설명, 내부 판단은 전문 검사명을 유지합니다.
===================================================== */
const getRecommendedTestInfo = (testName) => {
  const cleanName = String(testName || '')
    .replace(' (마음사랑)', '')
    .replace(' (인싸이트)', '');

  const includes = (keyword) => cleanName.toLowerCase().includes(keyword.toLowerCase());

  if (includes('TCI')) {
    return {
      title: 'TCI 기질 및 성격검사',
      subtitle: '타고난 기질과 성격 특성을 함께 이해합니다.',
      desc: '새로운 상황에 대한 반응, 걱정과 신중함, 대인관계 민감성, 자기조절 방식 등을 살펴 상담 방향을 세우는 데 도움이 됩니다.',
      use: '반복되는 감정 반응과 관계 패턴을 이해하고 싶을 때 활용합니다.'
    };
  }
  if (includes('STS')) {
    return {
      title: 'STS 성격강점검사',
      subtitle: '현재 가지고 있는 강점과 심리적 자원을 확인합니다.',
      desc: '어려움만 보는 것이 아니라 내담자가 이미 가지고 있는 강점과 회복 자원을 함께 살펴봅니다.',
      use: '상담 목표를 세우고 회복 자원을 찾는 데 도움이 됩니다.'
    };
  }
  if (includes('MMPI')) {
    return {
      title: 'MMPI-2 다면적 인성검사',
      subtitle: '현재 심리상태와 정서적 어려움을 폭넓게 살펴봅니다.',
      desc: '우울, 불안, 스트레스 반응, 대인관계 어려움 등 현재 마음의 상태를 객관적으로 이해하는 데 활용됩니다.',
      use: '정서적 어려움이 크거나 상담 방향을 더 정밀하게 잡을 필요가 있을 때 도움이 됩니다.'
    };
  }
  if (includes('PAI')) {
    return {
      title: 'PAI 성격평가질문지',
      subtitle: '성격 특성과 정서·대인관계 적응 양상을 살펴봅니다.',
      desc: '일상생활에서 반복되는 정서 반응, 관계 방식, 스트레스 적응 양상을 이해하는 데 도움이 됩니다.',
      use: '현재 어려움이 여러 영역에 걸쳐 복합적으로 나타날 때 활용합니다.'
    };
  }
  if (includes('K-IIP') || includes('대인관계')) {
    return {
      title: '대인관계문제검사',
      subtitle: '관계 속에서 반복되는 어려움의 패턴을 확인합니다.',
      desc: '거절이 어려움, 거리두기, 의존, 자기표현의 어려움 등 관계에서 반복되는 방식을 살펴봅니다.',
      use: '부부, 가족, 직장, 친구 관계에서 비슷한 갈등이 반복될 때 도움이 됩니다.'
    };
  }
  if (includes('SCT') || includes('문장완성')) {
    return {
      title: '문장완성검사',
      subtitle: '말로 다 표현하기 어려운 마음의 단서를 살펴봅니다.',
      desc: '미완성 문장을 완성하는 방식으로 자신, 가족, 관계, 미래에 대한 생각과 감정을 탐색합니다.',
      use: '내담자의 내면 주제와 상담에서 함께 다룰 이야기를 찾는 데 도움이 됩니다.'
    };
  }
  if (includes('HTP') || includes('그림')) {
    return {
      title: '집-나무-사람 그림검사',
      subtitle: '그림을 통해 정서와 자기상을 탐색합니다.',
      desc: '언어로 표현하기 어려운 정서, 자기이해, 환경에 대한 느낌을 부드럽게 살펴보는 검사입니다.',
      use: '아동·청소년, 부모-자녀 상담 또는 말로 표현하기 어려운 주제를 다룰 때 도움이 됩니다.'
    };
  }
  if (includes('PAT') || includes('양육태도')) {
    return {
      title: 'PAT 부모양육태도검사',
      subtitle: '양육 태도와 부모-자녀 상호작용을 살펴봅니다.',
      desc: '부모의 양육 방식과 자녀와의 관계에서 나타나는 강점과 어려움을 이해하는 데 활용됩니다.',
      use: '부모 상담과 양육코칭 방향을 세우는 데 도움이 됩니다.'
    };
  }
  if (includes('KCDI') || includes('아동발달')) {
    return {
      title: 'K-CDI 아동발달검사',
      subtitle: '아동의 전반적인 발달 수준을 점검합니다.',
      desc: '언어, 인지, 사회성, 운동, 자조행동 등 발달 영역을 살펴 현재 발달 상태를 이해합니다.',
      use: '영유아 발달지원과 부모 상담의 기초자료로 활용합니다.'
    };
  }
  if (includes('회복탄력')) {
    return {
      title: '회복탄력성검사',
      subtitle: '스트레스 이후 다시 회복하는 힘을 확인합니다.',
      desc: '자기조절, 관계 자원, 긍정성 등 어려움을 견디고 회복하는 심리적 자원을 살펴봅니다.',
      use: '스트레스가 반복되거나 소진감이 클 때 회복 방향을 찾는 데 도움이 됩니다.'
    };
  }
  if (includes('직무스트레스')) {
    return {
      title: '직무스트레스검사',
      subtitle: '일과 직장 환경에서 오는 부담을 구체적으로 살펴봅니다.',
      desc: '업무량, 조직문화, 관계갈등, 보상, 역할갈등 등 직장에서 경험하는 스트레스 요인을 확인합니다.',
      use: '직장 스트레스와 소진, 이직 고민, 업무 적응 문제를 다룰 때 도움이 됩니다.'
    };
  }
  if (includes('Holland') || includes('진로') || includes('직업흥미')) {
    return {
      title: '직업흥미·진로검사',
      subtitle: '흥미와 진로 방향을 이해합니다.',
      desc: '개인의 흥미, 적성, 직업 선호를 살펴 진로 선택이나 직무 방향을 탐색하는 데 활용합니다.',
      use: '진로 고민, 직업 전환, 학업·직무 선택이 필요할 때 도움이 됩니다.'
    };
  }
  if (includes('CAD') || includes('주의집중')) {
    return {
      title: '주의집중력검사',
      subtitle: '집중과 학습 관련 어려움을 살펴봅니다.',
      desc: '주의 유지, 충동성, 학습 장면에서의 집중 어려움 등을 확인하는 데 활용합니다.',
      use: '청소년 학습·생활 상담에서 현재 어려움을 이해하는 자료가 됩니다.'
    };
  }
  if (includes('GOLDEN')) {
    return {
      title: '성격유형검사',
      subtitle: '자기이해와 관계 방식을 살펴봅니다.',
      desc: '개인의 선호 경향과 관계 방식, 의사결정 스타일을 이해하는 데 도움이 됩니다.',
      use: '자기이해와 대인관계 소통 방식을 정리할 때 활용합니다.'
    };
  }

  return {
    title: cleanName || '나에게 도움이 될 수 있는 심리검사',
    subtitle: '현재 호소와 상담 목적에 따라 추천된 검사입니다.',
    desc: 'AI 마음 상담에서 나타난 어려움과 상담 목적을 바탕으로 추천되었습니다.',
    use: '상담에서 내담자를 더 깊이 이해하고 방향을 세우는 참고자료로 활용됩니다.'
  };
};

const psychTests = [
  {
    id: 'TCI',
    name: 'TCI (기질 및 성격검사)',
    sub: '타고난 기질과 자라난 성격의 하모니',
    desc: '내가 바꿀 수 없는 선천적 ‘기질’과 살아가며 변하는 후천적 ‘성격’을 구분하여, 자신에 대한 깊은 유전적/인격적 이해를 돕습니다.',
    tags: ['기질분석', '대인관계', '성격이해'],
    icon: 'heart',
    color: 'from-blue-400 to-indigo-500'
  },
  {
    id: 'MMPI',
    name: 'MMPI-2 (다면적 인성검사)',
    sub: '가장 객관적이고 신뢰도 높은 마음 검진',
    desc: '전 세계 임상 및 심리 상담 현장에서 가장 보편적으로 사용되는 표준 정신건강 검사입니다. 스트레스, 대처 방식, 임상적 척도를 과학적으로 분석합니다.',
    tags: ['정신건강', '스트레스수치', '임상진단'],
    icon: 'activity',
    color: 'from-purple-400 to-pink-500'
  },
  {
    id: 'PAI',
    name: 'PAI (성격평가질문지)',
    sub: '일상의 부적응과 성격 특성의 복합 진단',
    desc: '정신 건강뿐만 아니라 대인관계 상호작용, 일상생활 속에서 겪을 수 있는 특정 성격적 단서와 행동의 어려움을 빠르고 정확하게 분석합니다.',
    tags: ['성격장애예방', '행동분석', '치료계획'],
    icon: 'user-check',
    color: 'from-indigo-400 to-cyan-500'
  },
  {
    id: 'KCDI',
    name: 'KCDI (아동발달검사)',
    sub: '우리 아이의 발달적 성숙도 점검',
    desc: '사회성, 자조행동, 대소근육, 언어, 인지 등 다차원적 아동 발달 상태를 점검하여 부모가 꼭 알아야 할 우리 아이의 발달 궤적을 확인합니다.',
    tags: ['아동발달', '육아코칭', '성장체크'],
    icon: 'baby',
    color: 'from-emerald-400 to-teal-500'
  },
  {
    id: 'STS',
    name: 'STS (6요인 기질검사)',
    sub: '여섯 가지 차원으로 분석하는 내면의 정교한 지도',
    desc: '활동성, 조심성, 긍정·부정정서, 사회적 민강성, 의도적 조절의 6가지 핵심 요인을 통해 개인의 타고난 성향과 성격적 특성을 입체적으로 분석합니다.',
    tags: ['6대기질', '성격특성', '다차원진단'],
    icon: 'compass',
    color: 'from-amber-400 to-orange-500'
  },
  {
    id: 'PAT',
    name: 'PAT (부모양육태도검사)',
    sub: '나는 어떤 부모일까? 양육 스타일 리포트',
    desc: '지지표현, 합리적 설명, 과잉기대, 거부 등 부모가 일상적으로 자녀에게 행사하는 양육 태도의 강약을 객관적으로 수치화하여 올바른 훈육 방향을 제시합니다.',
    tags: ['부모양육', '가족관계', '소통코칭'],
    icon: 'users',
    color: 'from-rose-400 to-red-500'
  },
  {
    id: 'RESILIENCE',
    name: '회복탄력성 검사 (Resilience)',
    sub: '넘어져도 다시 일어날 수 있는 마음의 탄성력',
    desc: '인생의 크고 작은 스트레스와 역경에 직면했을 때, 이에 굴하지 않고 딛고 일어나 전보다 더 크게 성장할 수 있는 힘, 즉 마침표(.)에서 시작으로 가는 힘을 분석합니다.',
    tags: ['스트레스저항', '자기효능감', '다시시작'],
    icon: 'refresh-cw',
    color: 'from-teal-400 to-emerald-600'
  },
  {
    id: 'JOB_STRESS',
    name: '직무스트레스 검사',
    sub: '직장 내 긴장과 소진 수준 점검',
    desc: '업무 부담, 역할 갈등, 조직문화, 관계 스트레스, 번아웃 신호를 확인하여 직장생활 회복 전략을 세웁니다.',
    tags: ['직장스트레스', '번아웃', '조직관계'],
    icon: 'briefcase',
    color: 'from-slate-400 to-gray-600'
  },
  {
    id: 'CAREER',
    name: '진로·직업흥미 검사',
    sub: '흥미와 강점 기반 진로 방향 탐색',
    desc: '흥미, 가치, 강점, 직업 선호를 바탕으로 현재의 진로 고민과 앞으로의 선택 방향을 구체화합니다.',
    tags: ['진로', '직업흥미', '강점탐색'],
    icon: 'map',
    color: 'from-green-400 to-emerald-500'
  },
  {
    id: 'SCT',
    name: 'SCT (문장완성검사)',
    sub: '문장을 통해 마음을 들여다보기',
    desc: '미완성 문장을 완성하는 과정을 통해 현재의 생각, 감정, 대인관계, 자기인식 등을 탐색합니다.',
    tags: ['자기이해', '감정탐색', '대인관계'],
    icon: 'message-square',
    color: 'from-purple-400 to-indigo-600' 
  },
  {
    id: 'HTP',
    name: 'HTP (집-나무-사람 그림검사)',
    sub: '그림으로 표현하는 마음',
    desc: '집, 나무, 사람을 그리는 과정을 통해 정서 상태, 자기상, 관계 특성을 탐색하는 투사검사입니다.',
    tags: ['그림검사', '정서이해', '자기탐색'],
    icon: 'pencil',
    color: 'from-emerald-400 to-teal-600' 
  },
  {
    id: 'KIIP',
    name: 'K-IIP (대인관계문제검사)',
    sub: '관계 속 반복되는 패턴 이해',
    desc: '대인관계에서 반복적으로 경험하는 어려움과 갈등 패턴을 분석하여 보다 건강한 관계 형성을 돕습니다.',
    tags: ['대인관계', '소통', '관계갈등'],
    icon: 'users',
    color: 'from-cyan-400 to-blue-500'
  },
  {
    id: 'GOLDEN',
    name: 'GOLDEN 성격유형검사',
    sub: '성격유형과 삶의 방향 탐색',
    desc: '개인의 성격유형과 강점을 이해하고 진로 및 인간관계에서의 특성을 탐색합니다.',
    tags: ['성격유형', '자기이해', '진로'],
    icon: 'compass',
    color: 'from-amber-400 to-orange-500'
  },
  {
    id: 'CAD',
    name: 'CAD 주의집중력검사',
    sub: '집중력과 학습 특성 분석',
    desc: '주의집중력 수준과 학습 과정에서의 강점 및 어려움을 확인합니다.',
    tags: ['주의집중', '학습', '청소년'],
    icon: 'crosshair',
    color: 'from-purple-400 to-pink-500'
  },
  {
    id: 'HOLLAND',
    name: 'Holland 진로발달검사',
    sub: '흥미와 적성 기반 진로탐색',
    desc: '개인의 흥미 유형을 분석하여 적합한 학과 및 직업 영역을 탐색합니다.',
    tags: ['진로', '적성', '청소년'],
    icon: 'compass',
    color: 'from-green-400 to-emerald-500'
  }
];
        const programs = [
    {
    id: 'p1',
    badge: 'AI 마음 상담 + 전문가 상담',
    title: '개인 마음이음',
    subtitle: '나를 이해하는 심리검사와 해석상담',
    desc: '심리검사를 통해 현재의 마음을 이해하고, 반복되는 고민의 원인을 함께 살펴보며 자신에게 맞는 변화와 성장의 방향을 찾아갑니다.',
    target: '✔ 나를 더 이해하고 싶은 분\n✔ 우울·불안·스트레스를 겪는 분\n✔ 진로 방향을 고민하는 분\n✔ 직장 내 스트레스와 소진을 겪는 분',
    test: 'TCI · MMPI-2 · 진로검사 · 직무스트레스 · 회복탄력성 등 맞춤 선택',
    time: '약 50분',
    img: 'https://placehold.co/600x400/EEF7F4/4B5563?text=Personal+Mind'
},
    {
    id: 'p5',
    badge: 'AI 마음 상담 + 전문가 상담',
    title: '부부 마음이음',
    subtitle: '서로를 이해하는 심리검사와 해석상담',
    desc: '심리검사를 통해 서로의 기질과 성격을 이해하고, 공감과 더 건강한 소통으로 행복한 관계를 만들어갑니다.',
    target: '✔ 서로를 이해하고 싶은 부부\n✔ 반복되는 갈등이 있는 부부\n✔ 관계를 회복하고 싶은 부부',
    test: '(J)TCI × 2',
    time: '약 80분',
    img: 'https://placehold.co/600x400/EEF7F4/4B5563?text=Couple'
},
    {
    id: 'p3',
    badge: 'AI 마음 상담 + 전문가 상담',
    title: '부모-자녀 마음이음',
    subtitle: '아이의 행동관찰과 심리검사 기반 양육상담',
    desc: '부모의 양육태도와 자녀의 발달 특성을 이해하고, 건강한 양육과 부모·자녀 관계 형성을 돕습니다.',
    target: '✔ 아이를 더 이해하고 싶은 부모\n✔ 양육이 어려운 부모\n✔ 부모-자녀 갈등을 해결하고 싶은 가족',
    test: 'PAT · KCDI (기본) · STS (필요 시 부모 TCI)',
    time: '약 80분 (행동관찰 포함)',
    img: 'https://placehold.co/600x400/EEF7F4/4B5563?text=Parenting'
},
    /*{
        id: 'p2',
        badge: 'TCI 그룹 클래스',
        title: '집단 알아차림 프로그램',
        subtitle: '(소규모 그룹)',
        desc: '사전에 TCI(기질 및 성격검사)를 진행하여 타고난 기질과 성격 데이터를 개별적으로 파악한 후, 이를 바탕으로 나와 타인의 차이를 안전하게 이해하고 서로의 물음표를 느낌표(!)로 키워 나가는 집단 기반 패키지입니다.',
        target: '타인의 공감 속에서 나를 안전하게 이해하고 싶은 분들',
        time: '주 1회(120분) / 총 4주 과정',
        img: 'https://placehold.co/600x400/f3e8ff/334155?text=Group+Workshop'
    },
    {
        id: 'p4',
        badge: '심리검사 기반 번아웃 코칭',
        title: '집단 마음 리스타트 프로그램',
        subtitle: '(번아웃 예방)',
        desc: 'TCI(기질 및 성격검사) 및 회복탄력성 지표를 사전에 측정하여 수치화된 번아웃 상태를 파악한 뒤, 구성원이 일의 마침표(.) 후 다시 힘찬 에너지를 채워갈 수 있도록 돕는 진단 기반 패키지입니다.',
        target: '집단원의 멘탈케어 및 힐링 워크숍이 필요한 분들',
        time: '2시간 코스',
        img: 'https://placehold.co/600x400/f1f5f9/334155?text=Corporate+Mental+Care'
    }*/
];

           const generateMindAnalysis = () => {

    // 2. 글자 입력 여부 체크 (기존 코드)
    if (!mindState.trim()) {
        setMindInputError(true);
        return;
    }
    setMindInputError(false);
    setIsAnalyzing(true);
    setAnalysisResult('');

    // 3. Netlify 서버리스 함수 호출 (기존 코드)
    fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
    mindState,
    mindPunctuation,
    aiRole: "Modumam Lab 상담 접수를 담당하는 AI 마음지기",
    aiPurpose: "AI 마음리포트와 AI 마음체크를 통해 마음을 이해하고 현재의 마음을 정리하며, 필요한 경우 심리검사를 추천합니다. 진단이나 최종 해석은 하지 않습니다.",
    expertRole: "심리검사 최종 해석과 상담은 국가기술자격 임상심리사 1급이 진행합니다."
})
    })
    .then(function(response) {
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        return response.json();
    })
    .then(function(result) {
        const text = result?.text;
        if (text) {
            setAnalysisResult(text);
            const newRecord = {
                id: Date.now(),
                createdAt: new Date().toLocaleString(),
                punctuation: mindPunctuation,
                input: mindState,
                result: text
            };
            setMindRecords((prev) => {
                const next = [newRecord, ...prev].slice(0, 20);
                localStorage.setItem(getMindReportStorageKey(), JSON.stringify(next));
                return next;
            });
        } else {
            setAnalysisResult("마음의 신호가 잘 닿지 않았나 봅니다. 다시 한번 차분히 눌러주시면 조용히 귀 기울이겠습니다.");
        }
    })
    .catch(function(error) {
        console.error("Gemini API Error", error);
        setAnalysisResult("AI 연결 오류: " + error.message);
    })
    .finally(function() {
        setIsAnalyzing(false);
    });
};

const generateIntakeSummary = () => {
    const hasAnyInput = Object.values(intakeForm).some(value => String(value).trim());

    if (!hasAnyInput) {
        setIntakeResult('현재 마음 상태를 한두 문장이라도 적어주시면 마음 상담을 완료할 수 있습니다.');
        return;
    }

    const riskText = intakeForm.risk
        ? `\n\n위기 신호 확인: ${intakeForm.risk}`
        : '';

    const summaryText = `AI 상담자가 이해한 마음정리\n\n신청자: ${authForm.name || '이름 미입력'}\n연락처: ${authForm.phone || '연락처 미입력'}\n이메일: ${authForm.email || '이메일 미입력'}\n접수일시: ${new Date().toLocaleString()}\n\n현재 주호소: ${intakeForm.concern || '추가 확인 필요'}\n지속 기간: ${intakeForm.duration || '추가 확인 필요'}\n수면 상태: ${intakeForm.sleep || '추가 확인 필요'}\n식욕/신체 상태: ${intakeForm.appetite || '추가 확인 필요'}\n관계/환경 요인: ${intakeForm.relationship || '추가 확인 필요'}${riskText}\n상담 목표: ${intakeForm.goal || '추가 확인 필요'}\n\n추천 흐름: 현재 내용만으로는 진단을 내리지 않고, 초기 상담에서 주호소와 생활 리듬을 먼저 정리한 뒤 필요한 경우 TCI, SCT, MMPI-2, PAI 중 적합한 검사를 선택하는 것이 좋겠습니다. 위기 신호가 높거나 자·타해 위험이 있다면 즉시 112, 119 또는 가까운 응급실 등 긴급 도움을 우선 이용해 주세요.`;

    const newSummary = {
        id: Date.now(),
        name: authForm.name || '이름 미입력',
        phone: authForm.phone || '연락처 미입력',
        email: authForm.email || '이메일 미입력',
        date: new Date().toLocaleString(),
        concern: intakeForm.concern || '',
        risk: intakeForm.risk || '',
        summary: summaryText,
        status: '신규접수'
    };

    const updatedSummaries = [newSummary, ...intakeSummaries];
    setIntakeSummaries(updatedSummaries);
    localStorage.setItem("modumam_intake_summaries", JSON.stringify(updatedSummaries));
    setIntakeResult('마음 상담이 완료되었습니다. 작성하신 내용은 관리자 전용 화면에서만 확인됩니다. 담당자가 확인 후 상담과 검사 진행 방향을 안내드리겠습니다.');
};

const toggleTest = (test) => {
  setSelectedTests(prev =>
    prev.includes(test)
      ? prev.filter(item => item !== test)
      : [...prev, test]
  );
}; 
            const handleAddBooking = async (e) => {
                e.preventDefault();
                if (!bookingName || !bookingPhone || !bookingDate || !bookingTime) {
                    setBookingAlert({ type: 'error', message: '예약 정보를 빠짐없이 입력해 주세요.' });
                    return;
                }

                /* [MOD-20260714-BOOKING-OPERATING-SETTINGS] 관리자 설정에 포함된 시간만 허용 */
                if (!bookingTimeOptions.includes(String(bookingTime))) {
                    setBookingAlert({
                        type: 'error',
                        message: `예약 가능 시간은 ${bookingOperatingSettings.openTime}부터 ${bookingOperatingSettings.closeTime}까지이며, ${bookingOperatingSettings.intervalMinutes}분 단위로 선택해 주세요.`
                    });
                    return;
                }

                /* [MOD-20260712-PARENT-BOOKING-013] 제출 단계 최종 검증 */
                const isParentBooking = bookingProgram.includes('부모-자녀 마음이음');
                const behaviorSelected = isParentBooking && selectedTests.includes('행동관찰');
                if (bookingType === '찾아가는(대면)' && !behaviorSelected) {
                    setBookingType('장소 조율(대면)');
                    setBookingAlert({ type: 'error', message: "찾아가는(대면)은 부모-자녀 마음이음의 '행동관찰'을 선택한 경우에만 신청할 수 있습니다." });
                    return;
                }
                if (behaviorSelected && bookingType !== '찾아가는(대면)') {
                    setBookingType('찾아가는(대면)');
                    setBookingAlert({ type: 'error', message: "행동관찰은 찾아가는(대면) 방식으로만 신청할 수 있습니다." });
                    return;
                }

                /* =====================================================
                   예약 필수 동의 검증
                   - 팝업 확인만으로 동의 처리하지 않습니다.
                   - 이용자가 예약 필수 동의 4개를 내용보기로 확인하고,
                     전자서명까지 입력해야 예약 신청이 완료됩니다.
                   - 수정 위치: 예약 필수 동의 체크 문구는 bookingConsentBox 검색
                ===================================================== */
                if (!bookingPrivacyConsent || !bookingServiceConsent || !bookingCounselingConsent || !bookingCancelConsent) {
                    alert('예약 신청 전, 예약 필수 동의 항목 4가지를 모두 확인해 주세요.');
                    setBookingAlert({ type: 'error', message: '예약 필수 동의 항목의 [내용보기]를 모두 확인한 뒤 전자서명을 완료해 주세요.' });
                    return;
                }

                if (!bookingSignature || bookingSignature.trim().length < 2) {
                    alert('예약 신청 전, 전자서명란에 신청인 성함을 입력해 주세요.');
                    setBookingAlert({ type: 'error', message: '전자서명란에 신청인 성함을 입력해야 예약 신청이 가능합니다.' });
                    return;
                }

              const newBooking = {
  id: Date.now(),
  name: bookingName,
  phone: bookingPhone,
  type: bookingType,
  date: bookingDate,
  time: bookingTime,
  program:
    selectedTests.length > 0
      ? `${bookingProgram} (${selectedTests.join(" + ")})`
      : bookingProgram,
  extraTests: selectedTests,
  selectedTests: selectedTests,
  applicationForm: {
    birth: bookingBirth,
    email: bookingEmail,
    contactMethod: bookingContactMethod,
    clientType: bookingClientType,
    concern: bookingConcern,
    counselingHistory: bookingCounselingHistory,
    medication: bookingMedication,
    diagnosis: bookingDiagnosis,
    risk: bookingRisk,
    submittedAt: new Date().toLocaleString()
  },
  bookingPrivacyConsent,
  bookingServiceConsent,
  bookingCounselingConsent,
  bookingCancelConsent,
  consentForm: {
    privacy: bookingPrivacyConsent,
    service: bookingServiceConsent,
    confidentiality: bookingCounselingConsent,
    cancelPolicy: bookingCancelConsent,
    signature: bookingSignature.trim(),
    signedAt: new Date().toLocaleString(),
    documentVersion: '예약 필수 동의 팝업확인 v2026-07-07'
  },
  documentStatus: '예약 필수 동의 완료 / 신청서·동의서 발송 예정',
  status: '승인대기',
  aiCounseling: bookingType === 'AI(비대면)',
  counselingDurationMinutes: bookingType === 'AI(비대면)' ? 50 : null,
  reportRequired: bookingType === 'AI(비대면)'
};

                const updatedReservations = mergeReservationRows(newBooking, reservations);
                setReservations(updatedReservations);

                // [MOD-20260714-RESERVATION-IDB-BRIDGE]
                // IndexedDB 저장을 우선 완료한 뒤 localStorage에도 가능한 범위에서 보조 저장합니다.
                try {
                    await saveReservationToIndexedDB(newBooking);
                } catch (error) {
                    setBookingAlert({ type: 'error', message: '예약 저장소 연결에 실패했습니다. 브라우저를 새로고침한 뒤 다시 신청해 주세요.' });
                    alert('예약 저장에 실패했습니다. 브라우저 저장소 사용이 허용되어 있는지 확인해 주세요.');
                    return;
                }

                try {
                    localStorage.setItem("modumam_reservations", JSON.stringify(updatedReservations));
                    const inbox = JSON.parse(localStorage.getItem("modumam_reservation_inbox") || "[]");
                    const mergedInbox = [newBooking, ...inbox.filter(item => String(item.id) !== String(newBooking.id))];
                    localStorage.setItem("modumam_reservation_inbox", JSON.stringify(mergedInbox.slice(0, 500)));
                    localStorage.setItem("modumam_last_reservation", JSON.stringify(newBooking));
                } catch (error) {
                    console.warn('localStorage 예약 보조 저장 실패:', error);
                }

                try {
                    const channel = new BroadcastChannel("modumam_operating_sync");
                    channel.postMessage({ type: "reservation-created", reservation: newBooking, at: Date.now() });
                    channel.close();
                } catch (error) {}

                setBookingAlert({ type: 'success', message: `${bookingName}님의 소중한 마음 예약이 정상적으로 신청되었습니다. 담당 상담사가 곧 연락드리겠습니다!` });
                alert('예약 신청이 완료되었습니다. 담당 상담사가 확인 후 연락드리겠습니다.');
                
               setBookingName('');
setBookingPhone('');
setBookingDate('');
setBookingTime('');
setBookingProgram("개인 마음이음");
setSelectedTests([]);
setBookingBirth('');
setBookingEmail('');
setBookingContactMethod('문자');
setBookingClientType('직장인·일반인');
setBookingConcern('');
setBookingCounselingHistory('');
setBookingMedication('');
setBookingDiagnosis('');
setBookingRisk('');
setBookingPrivacyConsent(false);
setBookingServiceConsent(false);
setBookingCounselingConsent(false);
setBookingCancelConsent(false);
setBookingSignature(''); 
            };

const getPaymentInfo = (res) => {
  /* =====================================================
     결제 금액 계산 규칙 V20
     - 기본 가격: 대면 상담비 50,000원 + 기본검사 30,000원 = 80,000원
     - 기본 가격: 비대면 상담비 20,000원 + 기본검사 30,000원 = 50,000원
     - 부부 마음이음, 부모-자녀 마음이음: 기본검사 2개 구성 → 기본검사 추가 30,000원
     - 추가검사: 1건당 30,000원
     - 무료검사: 문장완성검사, 집-나무-사람 그림검사, 우울검사, 불안검사, 스트레스검사
     가격 변경은 이 함수만 수정하면 됩니다.
  ===================================================== */
  const type = String(res.type || "");
  const program = String(res.program || res.bookingProgram || "");
  const extraTests = res.extraTests || res.selectedTests || res.additionalTests || [];
  const freeKeywords = ["무료", "기본", "문장완성검사", "집-나무-사람", "그림검사", "우울검사", "불안검사", "스트레스검사"];
  const paidExtraTests = Array.isArray(extraTests)
    ? extraTests.filter(test => {
        const label = String(test);
        return !freeKeywords.some(keyword => label.includes(keyword));
      })
    : [];

  // 주의: "비대면"에도 "대면"이라는 글자가 포함되므로,
  // 반드시 비대면 여부를 먼저 판단한 뒤 대면 여부를 계산합니다.
  const isRemote = type.includes("비대면") || type.includes("화상") || type.includes("전화") || type.includes("문자");
  const isFaceToFace = !isRemote && (type === "찾아가는(대면)" || type === "장소 조율(대면)" || type === "대면" || type.includes("대면"));
  const counselingAmount = isFaceToFace ? 80000 : 50000;
  const counselingLabel = isFaceToFace
    ? "상담비(대면) 50,000원 + 기본검사 30,000원"
    : "상담비(비대면) 20,000원 + 기본검사 30,000원";

  const needsBasicExtra = program.includes("부부") || program.includes("부모-자녀");
  const basicExtraAmount = needsBasicExtra ? 30000 : 0;
  const basicExtraLabel = needsBasicExtra ? "기본검사 추가 30,000원" : "기본검사 1개 포함";

  const extraCount = paidExtraTests.length;
  const extraAmount = extraCount * 30000;
  const totalAmount = counselingAmount + basicExtraAmount + extraAmount;

  const detailParts = [counselingLabel];
  if (needsBasicExtra) detailParts.push(basicExtraLabel);
  if (extraCount > 0) detailParts.push(`추가검사 ${extraCount}건 ${extraAmount.toLocaleString()}원`);

  return {
    total: `${totalAmount.toLocaleString()}원`,
    detail: detailParts.join(" + ")
  };
};
            const normalizeReservationStatus = (status) => {
              const aliases = {
                '승인대기': '예약신청',
                '예약확정': '예약승인',
                '결제대기': '예약승인',
                '검사링크발송': '검사발송',
                '검사진행': '검사발송',
                '결과작성': '결과업로드',
                '상담예정': '상담준비'
              };
              return aliases[status] || status || '예약신청';
            };

            const getStatusStyle = (status) => {
              const current = normalizeReservationStatus(status);
              if (["상담완료", "종결"].includes(current)) return "bg-emerald-100 text-emerald-700";
              if (["상담준비", "상담진행"].includes(current)) return "bg-teal-100 text-teal-700";
              if (current === "결과업로드") return "bg-purple-100 text-purple-700";
              if (current === "검사완료") return "bg-violet-100 text-violet-700";
              if (current === "검사발송") return "bg-indigo-100 text-indigo-700";
              if (["예약승인", "결제완료"].includes(current)) return "bg-blue-100 text-blue-700";
              if (current === "예약취소") return "bg-rose-100 text-rose-700";
              return "bg-amber-100 text-amber-700";
            };
            
        const updateReservationStatus = (id, status) => {
  const updated = reservations.map(res =>
    res.id === id ? { ...res, status } : res
  );

  setReservations(updated);
  localStorage.setItem("modumam_reservations", JSON.stringify(updated));
};

const cancelBooking = (id) => {
  updateReservationStatus(id, "예약취소");
};

// [MOD-20260713-MEMBER-SCHEDULE-NOTICE]
// 관리자가 변경한 상담일정 안내를 회원이 확인하면 읽음 상태로 저장합니다.
const confirmScheduleUpdate = (id) => {
  const updated = reservations.map(res =>
    res.id === id ? { ...res, scheduleUpdateUnread: false, scheduleUpdateConfirmedAt: new Date().toLocaleString('ko-KR') } : res
  );
  setReservations(updated);
  localStorage.setItem("modumam_reservations", JSON.stringify(updated));
};

// [MOD-20260713-MEMBER-STATUS-NOTICE]
// 관리자가 변경한 예약 진행상태를 회원이 확인하면 읽음 상태로 저장합니다.
const confirmStatusUpdate = (id) => {
  const updated = reservations.map(res =>
    res.id === id ? { ...res, statusUpdateUnread: false, statusUpdateConfirmedAt: new Date().toLocaleString('ko-KR') } : res
  );
  setReservations(updated);
  localStorage.setItem("modumam_reservations", JSON.stringify(updated));
};

const getMemberStatusMessage = (status) => {
  const current = normalizeReservationStatus(status);
  const messages = {
    '예약신청': '예약 신청이 접수되어 확인을 기다리고 있습니다.',
    '예약승인': '예약이 승인되었습니다. 결제 안내를 확인해 주세요.',
    '결제완료': '결제가 확인되었습니다. 필요한 경우 검사 링크를 보내드립니다.',
    '검사발송': '심리검사 링크가 발송되었습니다. 안내에 따라 검사를 진행해 주세요.',
    '검사완료': '심리검사가 완료되어 결과를 확인하고 있습니다.',
    '결과업로드': '검사결과가 등록되었습니다. 결과보고서와 상담 안내를 확인해 주세요.',
    '상담준비': '검사결과 상담을 준비하고 있습니다. 예약 일정을 확인해 주세요.',
    '상담진행': '상담이 진행 중입니다.',
    '상담완료': '상담이 완료되었습니다.',
    '종결': '모든 상담 과정이 종결되었습니다.',
    '예약취소': '예약이 취소되었습니다.'
  };
  return messages[current] || '예약 진행상태가 변경되었습니다.';
};

const findBestTest = () => {
  let matchedId = 'TCI';
    
if (userAge === 'parent') {
  if (userWorry === 'development') {
    matchedId = 'PAT';      // 기본 추천
  } else if (userWorry === 'relationship') {
    matchedId = 'PAT';      // 부모양육태도검사
  } else if (userWorry === 'character') {
    matchedId = 'TCI';      // 부모 기질 및 성격
  } else {
    matchedId = 'PAT';      // 부모·양육자는 기본 PAT
  }
  } else {
    // 일반 성인 및 청소년 타겟 매칭
    if (userWorry === 'emotion') {
      matchedId = 'MMPI';       // 불안·우울 등 정신적 피로 -> 다면적 인성검사
    } else if (userWorry === 'relationship') {
      matchedId = 'KIIP';       // 대인관계 및 소통 어려움 -> 대인관계문제검사 (또는 PAI)
   } else if (userWorry === 'meaning') {
      matchedId = 'GOLDEN';     // 인생의 깊은 의미 성찰 -> 골든성격유형검사
    } else if (userWorry === 'resilience') {
      matchedId = 'RESILIENCE'; // 스트레스 극복 -> 회복탄력성 검사
    } else if (userWorry === 'career') {
      matchedId = 'HOLLAND';    // 학습·진로 -> 홀랜드 진로발달검사
    } else {
      matchedId = 'TCI';        // 기질 및 성격 특성 -> 기본 TCI
    }
  }

  // 데이터 풀(psychTests)에서 해당 검사 object를 찾아 상태에 반영
  const test = psychTests.find(t => t.id === matchedId);
  setTestResult(test || null);
};

            /* =====================================================
               [MOD-20260710-002] 마이페이지 이용 권한 판단
               - 마이페이지 접근 권한은 로그인 여부로 판단합니다.
               - hasPaidAccess는 마음기록/결과확인 등 결제 후 기능 잠금에만 사용합니다.
            ===================================================== */
            let currentUser = null;
            try {
                currentUser = JSON.parse(localStorage.getItem('modumamUser') || 'null');
            } catch (e) {
                currentUser = null;
            }
            const currentPhone = String(currentUser?.phone || authForm.phone || '').replace(/[^0-9]/g, '');
            const currentName = String(currentUser?.name || authForm.name || '').trim();
            const userReservations = reservations.filter((r) => {
                const rp = String(r.phone || '').replace(/[^0-9]/g, '');
                const rn = String(r.name || '').trim();
                return (currentPhone && rp && currentPhone === rp) || (currentName && rn && currentName === rn);
            });
            const hasPaidAccess = userReservations.some((r) =>
                ['예약승인', '결제완료', '검사발송', '검사완료', '결과업로드', '상담준비', '상담진행', '상담완료', '종결'].includes(normalizeReservationStatus(r.status))
            );
            const userIntakeSummaries = intakeSummaries.filter((i) => {
                const ip = String(i.phone || '').replace(/[^0-9]/g, '');
                const iname = String(i.name || '').trim();
                return (currentPhone && ip && currentPhone === ip) || (currentName && iname && currentName === iname);
            });
            const hasMyIntake = userIntakeSummaries.length > 0;

            const normalizeRecordDate = (value) => {
                const parsed = new Date(value || 0).getTime();
                return Number.isFinite(parsed) ? parsed : 0;
            };

            const aiRecordKeyword = aiRecordSearch.trim().toLowerCase();

            const filteredMindRecords = [...mindRecords]
                .filter((record) => {
                    if (!aiRecordKeyword) return true;
                    const target = `${record.input || ''} ${record.result || ''}`.toLowerCase();
                    return target.includes(aiRecordKeyword);
                })
                .sort((a, b) => {
                    const aDate = normalizeRecordDate(a.createdAt);
                    const bDate = normalizeRecordDate(b.createdAt);
                    return aiRecordSort === 'oldest' ? aDate - bDate : bDate - aDate;
                });

            const filteredAiIntakeRecords = [...userIntakeSummaries]
                .filter((record) => {
                    if (!aiRecordKeyword) return true;
                    const target = `${record.mainConcern || ''} ${record.theme?.label || ''} ${record.mindReflection || ''} ${record.summary || ''}`.toLowerCase();
                    return target.includes(aiRecordKeyword);
                })
                .sort((a, b) => {
                    const aDate = normalizeRecordDate(a.date);
                    const bDate = normalizeRecordDate(b.date);
                    return aiRecordSort === 'oldest' ? aDate - bDate : bDate - aDate;
                });
            const myPageSteps = [
                { title: '회원가입', desc: isLoggedIn || currentUser ? '완료' : 'AI 마음 상담 전 필요', done: !!(isLoggedIn || currentUser), locked: false },
                { title: 'AI 마음 상담', desc: hasMyIntake ? '완료' : '회원가입 후 이용', done: hasMyIntake, locked: !(isLoggedIn || currentUser) },
                { title: '검사신청·결제', desc: hasPaidAccess ? '확인 완료' : 'AI 추천 후 진행', done: hasPaidAccess, locked: !(isLoggedIn || currentUser) },
                { title: '상담신청서·동의서', desc: '예약 3일 전 안내', done: userReservations.some(r => r.bookingPrivacyConsent || r.bookingCounselingConsent), locked: !(isLoggedIn || currentUser) },
                { title: '마음기록', desc: hasPaidAccess ? '이용 가능' : '신청/결제 후 열림', done: mindRecords.length > 0, locked: !hasPaidAccess },
                { title: '결과확인', desc: hasPaidAccess ? '전문가 확인 후 승인' : '검사 신청 후 열림', done: false, locked: !hasPaidAccess }
            ];
                      
            const punctuationDetails = {
                question: {
                    symbol: '?', label: '지금 내 마음은? (?)', badge: '혼란과 탐색 (Self-Inquiry)', color: 'indigo',
                    title: '내 마음이 보내는 질문',
                    desc: '마음이 요동치고 불안이 찾아올 때, 우리는 먼저 브레이크를 걸고 친절하게 내밀한 호기심을 가져야 합니다. "내 마음이 지금 왜 이럴까?"라는 질문은 회피하지 않고 마음의 신호에 귀 기울이는 소중한 첫걸음이 됩니다.',
                    points: ['불안, 우울, 번아웃 상태를 차분히 살펴보기', '내면의 엉킨 생각 실타래 마주하기']
                },
                exclamation: {
                    symbol: '!', label: '알아차림 (!)', badge: '자각과 수용 (Awareness)', color: 'amber',
                    title: '감정을 알아차리는 순간',
                    desc: '"아, 내가 지금 외로웠구나", "내가 그때 그 상처 때문에 아직 힘들어하는구나"라고 스스로 인정하는 과정입니다. 가려져 있던 감정의 본질을 직시할 때 진정한 위로와 정돈이 시작됩니다.',
                    points: ['기질과 성격을 입체적으로 이해하기', '객관적이고 정교한 심리검사 매칭으로 이어가기']
                },
                comma: {
                    symbol: ',', label: '쉼 (,)', badge: '휴식과 돌봄 (Self-Care)', color: 'emerald',
                    title: '잠시 쉬어가도 괜찮은 시간',
                    desc: '숨가쁘게 달려가던 발걸음에 쉼표를 부여하는 작업입니다. 온전히 쉬어도 되는 마음의 자유를 허락할 때, 마음의 배터리가 다시 자라납니다.',
                    points: ['심리적 이완과 자기돌봄 회복하기', '상담사 및 온전한 지지자와 연결하기']
                },
                period: {
                    symbol: '.', label: '다시 시작 (.)', badge: '매듭과 새로운 도약 (Reset & Restart)', color: 'slate',
                    title: '오늘의 마음에 마침표 찍기',
                    desc: '지나간 자책과 아쉬움을 끝매듭 짓는 마침표입니다. 슬픔에 마침표를 찍고, 더 탄력 있고 단단한 힘을 품어 새로운 삶의 첫머리로 들어가는 과정입니다.',
                    points: ['마음의 회복탄력성 키우기', '현실 일상과 부드럽게 화해하기']
                }
            };
            const punctuationColorClasses = {
                question: 'from-indigo-50 border-indigo-100 text-indigo-500 bg-indigo-50',
                exclamation: 'from-amber-50 border-amber-100 text-amber-500 bg-amber-50',
                comma: 'from-emerald-50 border-emerald-100 text-emerald-500 bg-emerald-50',
                period: 'from-slate-100 border-slate-200 text-slate-600 bg-slate-100'
            };
            const activePunctuationDetail = punctuationDetails[selectedPunctuation];

            const bookingConsentContents = {
                privacy: {
                    title: '개인정보 수집·이용 동의',
                    badge: '필수 동의 1',
                    setter: setBookingPrivacyConsent,
                    body: [
                        { heading: '수집 항목', lines: ['성명, 연락처, 이메일(선택), 예약 희망일시', '신청 프로그램 및 심리검사 선택 내역', '상담 준비를 위해 이용자가 직접 작성한 상담 관련 정보'] },
                        { heading: '이용 목적', lines: ['예약 확인 및 일정 안내', '심리검사 링크 발송 및 해석상담 진행', '상담 및 심리검사 서비스 제공과 사후 안내'] },
                        { heading: '보관 및 동의 거부', lines: ['수집된 정보는 서비스 제공과 관련 법령에 필요한 기간 동안 보관될 수 있습니다.', '동의를 거부할 권리가 있으나, 필수 항목에 동의하지 않을 경우 예약 서비스 이용이 제한될 수 있습니다.'] }
                    ]
                },
                service: {
                    title: '심리검사 및 상담 서비스 이용 동의',
                    badge: '필수 동의 2',
                    setter: setBookingServiceConsent,
                    body: [
                        { heading: '서비스 성격', lines: ['심리검사는 현재 마음 상태와 성격·기질·관계 패턴을 이해하기 위한 심리평가 도구입니다.', '본 서비스는 의학적 진단이나 약물치료를 대신하지 않습니다.'] },
                        { heading: '검사 및 상담 진행', lines: ['검사 결과는 전문가 해석상담과 함께 이해할 때 가장 도움이 됩니다.', '필요한 검사는 신청 내용과 상담자의 판단에 따라 조정될 수 있습니다.'] },
                        { heading: '결과 안내', lines: ['온라인 검사 링크와 결과 관련 안내는 신청자 본인에게만 제공됩니다.', '최종 해석과 상담계획은 전문가 상담을 통해 확정됩니다.'] }
                    ]
                },
                confidentiality: {
                    title: '비밀보장 및 상담윤리 안내',
                    badge: '필수 동의 3',
                    setter: setBookingCounselingConsent,
                    body: [
                        { heading: '비밀보장 원칙', lines: ['상담 및 심리검사 과정에서 알게 된 개인정보와 상담 내용은 상담윤리에 따라 비밀이 보장됩니다.', '동의 없이 제3자에게 상담 내용을 제공하지 않습니다.'] },
                        { heading: '비밀보장의 예외', lines: ['자해·자살 또는 타해 위험이 매우 높은 경우', '아동학대, 노인학대, 가정폭력 등 관련 법령상 신고의무가 있는 경우', '법원의 적법한 요청이나 안전을 위한 긴급 조치가 필요한 경우'] },
                        { heading: '안전 우선', lines: ['위 예외 상황에서는 내담자와 주변인의 안전을 위해 필요한 범위에서 보호자, 관계기관 또는 응급지원과 연결될 수 있습니다.'] }
                    ]
                },
                cancel: {
                    title: '예약 변경·취소 및 노쇼 규정',
                    badge: '필수 동의 4',
                    setter: setBookingCancelConsent,
                    body: [
                        { heading: '예약 변경', lines: ['예약 변경은 예약 24시간 전까지 요청해 주세요.', '검사 링크 발송 또는 상담 준비가 시작된 이후에는 일정 조정이 제한될 수 있습니다.'] },
                        { heading: '예약 취소', lines: ['예약 24시간 전까지 취소 요청 시 조정이 가능합니다.', '당일 취소는 검사 준비 및 상담 시간 확보로 인해 환불·변경 규정이 적용될 수 있습니다.'] },
                        { heading: '노쇼 안내', lines: ['사전 연락 없이 예약 시간에 참석하지 않는 경우 노쇼로 처리될 수 있습니다.', '노쇼 시 재예약이 제한되거나 환불 규정이 적용될 수 있습니다.', '부득이한 사정이 있는 경우 가능한 빨리 연락 주시면 최대한 조정해 드립니다.'] }
                    ]
                }
            };

            const confirmBookingConsent = () => {
                if (!bookingConsentModal) return;
                const item = bookingConsentContents[bookingConsentModal];
                if (item && item.setter) item.setter(true);
                setBookingConsentModal(null);
            };

            const bookingAllConsentChecked = bookingPrivacyConsent && bookingServiceConsent && bookingCounselingConsent && bookingCancelConsent;

            /* =====================================================
               [MOD-20260712-PARENT-BOOKING-008] 부모-자녀 행동관찰 예약 조건
               - 찾아가는(대면)은 부모-자녀 마음이음 + 행동관찰 선택 시에만 활성화
               - 공통 안내문은 모든 신청 프로그램에서 항상 표시
            ===================================================== */
            const isParentChildProgram = bookingProgram.includes('부모-자녀 마음이음');
            const hasBehaviorObservation = isParentChildProgram && selectedTests.includes('행동관찰');

            return (
                <div className="min-h-screen flex flex-col selection:bg-slate-200">
                    
                   <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 transition-all">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 cursor-pointer" onClick={() => scrollToSection('home')}>
            <div className="flex space-x-1 items-center bg-slate-100 p-2 sm:p-2.5 rounded-xl flex-shrink-0">
                <span className="font-extrabold text-mind-question text-base font-mono">?</span>
                <span className="font-extrabold text-mind-exclamation text-base font-mono">!</span>
                <span className="font-extrabold text-mind-comma text-base font-mono">,</span>
                <span className="font-extrabold text-mind-period text-base font-mono">.</span>
            </div>

            <div className="flex flex-col">
                <span className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight whitespace-nowrap">모두의 마음연구소</span>
                <span className="hidden sm:block text-[10px] text-slate-400 font-medium tracking-wide">Question - Awareness - Recharge - Restart</span>
            </div>
        </div>

        <nav className="hidden md:flex space-x-8 items-center">
            {/* [MOD-v1.1.0-002] PC 회원 메뉴: 로그인 전 회원가입|로그인, 로그인 후 이름|로그아웃 */}
            <div className="flex items-center gap-2 text-sm font-bold whitespace-nowrap">
                {isLoggedIn || currentUser ? (
                    <>
                        <span className="flex items-center gap-2 text-slate-700">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                            <span>{currentUser?.name || authForm.name || '회원'}님</span>
                        </span>
                        <span className="text-slate-300">|</span>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="text-slate-500 hover:text-rose-500 transition-colors"
                        >
                            로그아웃
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => { setAuthMode('signup'); setIsAuthModalOpen(true); }}
                            className="text-slate-600 hover:text-emerald-600 transition-colors"
                        >
                            회원가입
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                            type="button"
                            onClick={() => { setAuthMode('login'); setIsAuthModalOpen(true); }}
                            className="text-slate-600 hover:text-slate-900 transition-colors"
                        >
                            로그인
                        </button>
                    </>
                )}
            </div>

            <button onClick={() => scrollToSection('home')} className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
                마음연구
            </button>

            <button onClick={() => scrollToSection('mind-care')} className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors">
                AI 마음상담
            </button>

            <button onClick={() => scrollToSection('tests')} className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">
                심리검사
            </button>

            <button
                onClick={() => scrollToSection('reservations')}
                className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
            >
                검사예약
            </button>

            {/* [MOD-v1.1.4-001] 마이페이지 메뉴는 로그인한 회원에게만 표시 */}
            {(isLoggedIn || currentUser) && (
                <button onClick={handleMyPageClick} className="bg-slate-900 text-white px-6 py-2.5 rounded-full hover:bg-slate-800 hover:scale-105 transition-all shadow-md shadow-slate-100 text-sm font-bold">
                    {/* [MOD-20260710-007] 메뉴명: 마이페이지 → 나의 마음기록 */}
                    나의 마음기록
                </button>
            )}

            {/* 관리자 버튼은 개인정보 보호를 위해 홈페이지 화면에서 숨김 처리했습니다.
                관리자 접속 주소: /admin/index.html */}

        </nav>

        <div className="md:hidden flex items-center gap-2">
            {/* [MOD-v1.1.0-003] 모바일 회원 상태 표시 */}
            <span className={`text-[10px] font-extrabold rounded-full px-2.5 py-1 border ${isLoggedIn || currentUser ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                {isLoggedIn || currentUser ? `● ${currentUser?.name || authForm.name || '회원'}님` : '로그인 필요'}
            </span>
            <button
                onClick={() => setIsMobileMenuOpen(prev => !prev)}
                className="bg-slate-950 text-white px-4 py-2 rounded-full text-xs font-extrabold shadow-sm"
                aria-label="모바일 메뉴 열기"
            >
                메뉴
            </button>

            {/* 모바일 관리자 버튼 숨김: /admin/index.html 직접 접속 */}

        </div>
    </div>

    {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-xl shadow-lg">
            <div className="px-4 pt-4 text-center">
                {/* [MOD-v1.1.0-004] 모바일 메뉴 회원가입/로그인/로그아웃 */}
                <div className={`mb-3 rounded-2xl border px-3 py-2 text-xs font-extrabold ${isLoggedIn || currentUser ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                    {isLoggedIn || currentUser ? `${currentUser?.name || authForm.name || '회원'}님 로그인 중` : '로그인 후 이용할 수 있습니다'}
                </div>
                {isLoggedIn || currentUser ? (
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="mb-3 w-full rounded-2xl border border-rose-100 bg-white px-3 py-2 text-xs font-extrabold text-rose-500"
                    >
                        로그아웃
                    </button>
                ) : (
                    <div className="mb-3 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => { setIsMobileMenuOpen(false); setAuthMode('signup'); setIsAuthModalOpen(true); }}
                            className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700"
                        >
                            회원가입
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsMobileMenuOpen(false); setAuthMode('login'); setIsAuthModalOpen(true); }}
                            className="rounded-2xl border border-slate-100 bg-white px-3 py-2 text-xs font-extrabold text-slate-700"
                        >
                            로그인
                        </button>
                    </div>
                )}
            </div>
            <div className="px-4 pb-4 grid grid-cols-3 gap-2 text-center text-[11px] font-extrabold">
                <button onClick={() => { setIsMobileMenuOpen(false); scrollToSection('home'); }} className="rounded-2xl border border-slate-100 bg-slate-50 px-2 py-3 text-slate-700">마음연구</button>
                <button onClick={() => { setIsMobileMenuOpen(false); scrollToSection('mind-care'); }} className="rounded-2xl border border-emerald-100 bg-emerald-50 px-2 py-3 text-emerald-700">AI 마음상담</button>
                <button onClick={() => { setIsMobileMenuOpen(false); scrollToSection('tests'); }} className="rounded-2xl border border-indigo-100 bg-indigo-50 px-2 py-3 text-indigo-700">심리검사</button>
                <button onClick={() => { setIsMobileMenuOpen(false); scrollToSection('reservations'); }} className="rounded-2xl border border-slate-200 bg-slate-900 px-2 py-3 text-white">심리검사 예약</button>
                {/* [MOD-v1.1.4-002] 모바일 마이페이지도 로그인한 회원에게만 표시 */}
                {(isLoggedIn || currentUser) && (
                    <button onClick={() => { setIsMobileMenuOpen(false); handleMyPageClick(); }} className="rounded-2xl border border-emerald-200 bg-emerald-700 px-2 py-3 text-white">
                        {/* [MOD-20260710-007] 모바일 메뉴명: 마이페이지 → 나의 마음기록 */}
                        나의 마음기록
                    </button>
                )}
            </div>
        </div>
    )}
</header>

                    {activePunctuationDetail && (
                        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedPunctuation('all')}>
                            <div className={`w-full max-w-2xl bg-gradient-to-br ${punctuationColorClasses[selectedPunctuation].split(' ')[0]} to-white border ${punctuationColorClasses[selectedPunctuation].split(' ')[1]} rounded-[2rem] shadow-2xl p-6 sm:p-8 fade-in`} onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <span className={`text-xs font-bold uppercase tracking-widest ${punctuationColorClasses[selectedPunctuation].split(' ')[2]}`}>{activePunctuationDetail.badge}</span>
                                        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{activePunctuationDetail.label}</h3>
                                    </div>
                                    <div className={`w-16 h-16 rounded-3xl ${punctuationColorClasses[selectedPunctuation].split(' ')[3]} flex items-center justify-center text-5xl font-extrabold font-mono ${punctuationColorClasses[selectedPunctuation].split(' ')[2]}`}>
                                        {activePunctuationDetail.symbol}
                                    </div>
                                </div>
                                <h4 className="mt-6 text-lg font-extrabold text-slate-900">{activePunctuationDetail.title}</h4>
                                <p className="mt-3 text-slate-600 leading-relaxed text-sm sm:text-base">{activePunctuationDetail.desc}</p>
                                <ul className="mt-6 space-y-2 text-sm text-slate-600">
                                    {activePunctuationDetail.points.map((point, idx) => (
                                        <li key={idx} className="flex items-center"><Icon name="check" className={`w-4 h-4 mr-2 shrink-0 ${punctuationColorClasses[selectedPunctuation].split(' ')[2]}`} />{point}</li>
                                    ))}
                                </ul>
                                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end">
                                    <button onClick={() => setSelectedPunctuation('all')} className="px-5 py-3 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50">닫기</button>
                                    <button onClick={() => { setSelectedPunctuation('all'); scrollToSection('mind-care'); }} className="px-5 py-3 rounded-full bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">AI 마음체크로 이동</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <main className="flex-grow">
                        
                        <section id="home" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-mind-bg overflow-hidden">
                            <div className="max-w-7xl mx-auto text-center relative z-10">
                                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 mb-6 tracking-wide uppercase font-friendly">
                                    어디에 머물러 있어도 괜찮습니다
                                </span>
                                <h2 className="text-3xl sm:text-5xl font-bold text-slate-800 tracking-normal leading-relaxed mb-6 font-cozy">
                                    오늘 당신의 마음에 찍힌 <br className="hidden sm:inline"/>
                                    <span className="bg-gradient-to-r from-mind-question via-mind-exclamation to-mind-comma bg-clip-text text-transparent font-extrabold">부호</span>는 무엇인가요?
                                </h2>
                                <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-500 font-normal leading-relaxed mb-12 font-friendly">
                                    마음은 삶의 매 순간, 우리에게 끊임없이 신호를 보냅니다. 그 신호에 다정한 질문이 필요할 때는 물음표(?)를, 감정을 수용해야 할 때는 느낌표(!)를, 잠시 쉬어가야 할 때는 쉼표(,)를, 무너진 삶에 용기가 필요할 때는 마침표(.)를 붙여 보세요. 그리고 지금 당신의 마음에 찍힌 부호를 통해 자신을 이해하고, 자신을 돌보며, 삶의 다음 문장을 다시 써 내려가는 여정을 함께 해보아요.
                                </p>

                                {/* 4 Buttons Paradigm */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-16">
                                    {/* Question Mark Block */}
                                    <div className="group bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all text-center cursor-pointer" onClick={() => setSelectedPunctuation('question')}>
                                        <div className="w-14 h-14 bg-indigo-50 text-mind-question rounded-2xl flex items-center justify-center text-3xl font-extrabold mx-auto mb-4 group-hover:scale-110 transition-transform font-mono">?</div>
                                        <h3 className="text-base font-bold text-slate-800">지금 내 마음은?</h3>
                                        <p className="text-xs text-slate-400 mt-2">이유 모를 불안과 질문</p>
                                        <span className="inline-block mt-3 text-[11px] font-semibold text-mind-question opacity-0 group-hover:opacity-100 transition-opacity">혼란과 성찰 →</span>
                                    </div>

                                    {/* Exclamation Mark Block */}
                                    <div className="group bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-amber-100 hover:shadow-xl hover:shadow-amber-500/5 transition-all text-center cursor-pointer" onClick={() => setSelectedPunctuation('exclamation')}>
                                        <div className="w-14 h-14 bg-amber-50 text-mind-exclamation rounded-2xl flex items-center justify-center text-3xl font-extrabold mx-auto mb-4 group-hover:scale-110 transition-transform font-mono">!</div>
                                        <h3 className="text-base font-bold text-slate-800">알아차림</h3>
                                        <p className="text-xs text-slate-400 mt-2">감정을 그대로 마주하기</p>
                                        <span className="inline-block mt-3 text-[11px] font-semibold text-mind-exclamation opacity-0 group-hover:opacity-100 transition-opacity">자각과 수용 →</span>
                                    </div>

                                    {/* Comma Block */}
                                    <div className="group bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-emerald-100 hover:shadow-xl hover:shadow-emerald-500/5 transition-all text-center cursor-pointer" onClick={() => setSelectedPunctuation('comma')}>
                                        <div className="w-14 h-14 bg-emerald-50 text-mind-comma rounded-2xl flex items-center justify-center text-3xl font-extrabold mx-auto mb-4 group-hover:scale-110 transition-transform font-mono">,</div>
                                        <h3 className="text-base font-bold text-slate-800">쉼</h3>
                                        <p className="text-xs text-slate-400 mt-2">생각을 멈추고 쉬기</p>
                                        <span className="inline-block mt-3 text-[11px] font-semibold text-mind-comma opacity-0 group-hover:opacity-100 transition-opacity">휴식과 돌봄 →</span>
                                    </div>

                                    {/* Period Block */}
                                    <div className="group bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-500/5 transition-all text-center cursor-pointer" onClick={() => setSelectedPunctuation('period')}>
                                        <div className="w-14 h-14 bg-slate-100 text-mind-period rounded-2xl flex items-center justify-center text-3xl font-extrabold mx-auto mb-4 group-hover:scale-110 transition-transform font-mono">.</div>
                                        <h3 className="text-base font-bold text-slate-800">다시 시작</h3>
                                        <p className="text-xs text-slate-400 mt-2">딛고 일어날 수 있는 힘</p>
                                        <span className="inline-block mt-3 text-[11px] font-semibold text-mind-period opacity-0 group-hover:opacity-100 transition-opacity">매듭과 도약 →</span>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
                                    <button onClick={() => scrollToSection('mind-care')} className="w-full sm:w-auto bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/10 hover:scale-105 transition-all">
                                        AI 마음상담 바로가기
                                    </button>
                                    <button onClick={() => scrollToSection('tests')} className="w-full sm:w-auto bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-2xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all">
                                        심리검사 알아보기
                                    </button>
                                </div>
                            </div>

                            {/* Warm soft background circles */}
                            <div className="absolute top-1/4 left-0 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10 animate-blob"></div>
                            <div className="absolute top-1/3 right-0 w-80 h-80 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10 animate-blob animation-delay-2000"></div>
                            <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-25 -z-10 animate-blob animation-delay-4000"></div>
                        </section>

                        
                       <section id="mind-care" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
    <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full mb-3">
                AI 마음상담
            </span>

            <h2 className="text-3xl font-extrabold text-slate-900">
                내 마음을 부탁해
            </h2>

            <p className="mt-4 text-slate-500 text-sm sm:text-base leading-relaxed">
               모두의 마음연구소 AI 마음상담은 AI 마음리포트와 AI 마음체크를 통해 마음을 이해하고 알아차릴 수 있도록 돕습니다.
               <br />
               AI 마음리포트로 지금의 마음을 살펴보고, AI 마음체크에서 AI 마음지기와의 채팅형 대화를 이어가 보세요.
            </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden h-full flex flex-col">
                                    <div className="p-6 sm:p-10 h-full flex flex-col">
                                        <span className="inline-block self-start text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full mb-4">AI 마음리포트</span>

                                        <div className="mb-7">
                                            <label className="block text-sm font-bold text-slate-700 mb-3">
                                                1. 지금 내 마음이 보내는 신호는 어느 쪽인가요?
                                            </label>
                                            <div className="grid grid-cols-4 gap-3">
                                                <button 
                                                    type="button"
                                                    onClick={() => setMindPunctuation('?')}
                                                    className={`min-h-[132px] py-6 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${mindPunctuation === '?' ? 'border-mind-question bg-indigo-50/50 text-mind-question' : 'border-slate-100 hover:border-slate-200 text-slate-400'}`}
                                                >
                                                    <span className="text-4xl font-black font-mono">?</span>
                                                    <span className="text-sm font-bold mt-3">지금 내 마음은</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setMindPunctuation('!')}
                                                    className={`min-h-[132px] py-6 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${mindPunctuation === '!' ? 'border-mind-exclamation bg-amber-50/50 text-mind-exclamation' : 'border-slate-100 hover:border-slate-200 text-slate-400'}`}
                                                >
                                                    <span className="text-4xl font-black font-mono">!</span>
                                                    <span className="text-sm font-bold mt-3">알아차림</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setMindPunctuation(',')}
                                                    className={`min-h-[132px] py-6 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${mindPunctuation === ',' ? 'border-mind-comma bg-emerald-50/50 text-mind-comma' : 'border-slate-100 hover:border-slate-200 text-slate-400'}`}
                                                >
                                                    <span className="text-4xl font-black font-mono">,</span>
                                                    <span className="text-sm font-bold mt-3">쉼</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setMindPunctuation('.')}
                                                    className={`min-h-[132px] py-6 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${mindPunctuation === '.' ? 'border-mind-period bg-slate-100 text-mind-period' : 'border-slate-100 hover:border-slate-200 text-slate-400'}`}
                                                >
                                                    <span className="text-4xl font-black font-mono">.</span>
                                                    <span className="text-sm font-bold mt-3">다시시작</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mb-6 relative">
                                            <label className="block text-sm font-bold text-slate-700 mb-3">
                                                2. 어떤 고민이나 일들이 머릿속을 스치고 지나가나요? (자세히 적을수록 분석이 섬세해집니다)
                                            </label>
                                            <textarea 
                                                rows="5" 
                                                value={mindState}
                                                onChange={(e) => {
    setMindState(e.target.value);
}}
                                                placeholder="예) 요즘 아무리 쉬어도 지친 감정이 해소되지 않고 마음이 무겁습니다. 자존감도 부쩍 떨어지고 일도 손에 안 잡히는데... 왜 그런 것인지 어떻게 해야 할까요?"
                                                className={`w-full px-5 py-4 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-300 resize-none text-sm leading-relaxed min-h-[150px] ${mindInputError ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'}`}
                                            ></textarea>
                                            
                                            {mindInputError && (
                                                <div className="mt-2 text-xs font-semibold text-rose-500 flex items-center bg-rose-50 p-2.5 rounded-lg border border-rose-100 fade-in">
                                                    <Icon name="alert-circle" className="w-4 h-4 mr-1.5 shrink-0" />
                                                    고민 사연을 적어주시면 '모두의 마음연구소'만의 따뜻한 심층 치유 코멘트를 추천해 드릴 수 있습니다.
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-auto pt-8">
                                        <button 
    type="button" 
    onClick={() => {
    generateMindAnalysis();
}}
    disabled={isAnalyzing}
    className="w-full h-[54px] rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg transition-all flex items-center justify-center space-x-2"
>
    {isAnalyzing ? (
        <>
            <svg className="animate-spin h-5 w-5 text-white mr-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>마음의 소리 분석 중...</span>
        </>
    ) : (
        <>
            <Icon name="sparkles" className="w-5 h-5" />
            <span>AI 마음리포트 받기</span>
        </>
    )}
</button>
                                        <p className="mt-4 text-center text-xs text-slate-400 font-medium">
                                            ※ AI가 무료로 내 마음을 분석해 드려요.
                                        </p>
                                        </div>
                                    </div>

                                    {/* Analysis Output Window */}
                                    {analysisResult && (
                                        <div className="border-t border-slate-100 bg-slate-50 p-6 sm:p-10 fade-in">
                                            <div className="flex items-center space-x-3 mb-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white">
                                                    <Icon name="smile" className="w-5 h-5" />
                                              </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800">모두의 마음연구소 AI 마음지기</h4>
                                                    <p className="text-xs text-slate-400">당신의 이야기에 정성을 모아 답변을 드려요</p>
                                                </div>
                                            </div>
                                            
                                            <div className="prose prose-slate max-w-none text-sm text-slate-600 leading-relaxed bg-white p-6 rounded-2xl border border-slate-100 shadow-sm whitespace-pre-line">
                                             {analysisResult}
                                            </div>

                                            <div className="mt-6 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 justify-end">
                                                <button onClick={() => setAnalysisResult('')} className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-4 py-2">
                                                    닫기
                                                </button>
                                                
                                                <button
                                                  onClick={() => window.open('https://pf.kakao.com/_hQSXX/chat', '_blank')}
                                                  className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-xs font-bold px-5 py-2.5 rounded-full shadow-sm transition-all">
                                                    카카오 채널 문의
                                                 </button> 
                                                
                                                 <button
   onClick={() => {
    openAiIntakeChat();
}}
    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-sm transition-all"
>
    AI 마음 체크 시작하기
</button>

                                                </div>
                                        </div>
                                    )}
                                </div>
            <div className="bg-white rounded-3xl border border-amber-100 p-6 sm:p-8 shadow-xl h-full flex flex-col">
                <span className="inline-block text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full mb-4">AI 마음상담</span>
                <h3 className="text-2xl font-extrabold text-slate-900 leading-tight mb-4">AI 마음 체크</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    마음리포트 이후 더 깊게 이야기하고 싶을 때 이어지는 채팅형 상담입니다. 모두의 마음연구소 AI 마음지기와 자연스럽게 대화를 이어가고, 마음을 이해하는 시간을 가져보세요.
                </p>
                <div className="space-y-3 mb-6">
                    <div className="bg-amber-50 rounded-2xl p-4"><p className="font-bold text-amber-800 text-sm">1. 로그인 또는 회원가입</p><p className="text-xs text-slate-500 mt-1">마음체크는 회원 전용입니다. 이용하기 위해 로그인 또는 회원가입이 필요합니다.</p></div>
                    <div className="bg-slate-50 rounded-2xl p-4"><p className="font-bold text-slate-900 text-sm">2. 10분 자연스러운 대화와 정보 확인</p><p className="text-xs text-slate-500 mt-1">현재 고민을 따라 약 10분 동안 대화하며, 심리·상담·심리검사에 관한 질문에는 쉬운 말로 정보를 제공합니다.</p></div>
                    <div className="bg-emerald-50 rounded-2xl p-4"><p className="font-bold text-emerald-800 text-sm">3. 마음정리 + 심리검사 추천</p><p className="text-xs text-slate-500 mt-1">마음 정리와 함께 필요한 검사와 추천 이유를 안내합니다.</p></div>
                </div>
                <button type="button" onClick={openAiIntakeChat} className="mt-auto w-full h-[54px] bg-slate-900 hover:bg-slate-800 text-white px-7 rounded-2xl text-sm font-extrabold shadow-lg">
                    AI 마음체크 시작하기
                </button>
                <p className="mt-4 text-center text-xs text-slate-400 font-medium leading-relaxed">※ 회원 가입 또는 로그인 후 이용할 수 있습니다.</p>
            </div>
        </div>
    </div>
                        </section>

                        
                        {/* =====================================================
                           myPageSection · 회원/유료회원 진행상황
                           - 사용자는 여기서 현재 단계만 확인
                           - 결제/예약 확정 후 유료 기능 자동 활성화
                        ===================================================== */}
                        {/* =====================================================
                           [MOD-v1.1.4-003] 비회원 마이페이지 화면 숨김
                           - 마이페이지 메뉴와 섹션은 로그인한 회원에게만 렌더링합니다.
                           - 비회원은 헤더/모바일 메뉴에서도 마이페이지가 보이지 않으므로
                             빈 마이페이지 안내 화면이 노출되지 않습니다.
                        ===================================================== */}
                        {(isLoggedIn || currentUser) && (
                        <section id="mypage" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-y border-slate-100">
                            <div className="max-w-6xl mx-auto">
                                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
                                    <div>
                                        {/* =====================================================
                                           [MOD-20260710-007] 나의 마음기록 상단 문구
                                           - My Page / 마이페이지 문구 삭제
                                           - 요청한 제목과 안내 문구만 표시
                                        ===================================================== */}
                                        <h2 className="text-3xl font-extrabold text-slate-900">나의 마음기록</h2>
                                        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                                            오늘까지 이어온 마음의 기록을 한곳에서 확인하세요.
                                        </p>
                                    </div>
                                    {/* =====================================================
                                       [MOD-20260710-010] '내 마음 공간' 카드 전체 삭제
                                       - 중복 제목 제거
                                       - 상단 소개 후 바로 기능 카드 표시
                                    ===================================================== */}
                                </div>

                                {/* [MOD-20260710-006] 마이페이지는 회원이면 접근 가능하도록 안내 문구 수정 */}
                                {isLoggedIn || currentUser ? (
                                    <div className="mb-6 rounded-3xl bg-emerald-50 border border-emerald-100 p-5 text-sm text-emerald-900 leading-relaxed">
                                        나의 마음기록에 오신 것을 환영합니다. 마음기록과 결과확인은 심리검사 신청·결제 후 순차적으로 열립니다.
                                    </div>
                                ) : null}

                                {/* =====================================================
                                   [MOD-20260710-017] 나의 마음기록 구성 변경
                                   - 오늘의 마음: 내담자가 직접 작성하는 마음기록
                                   - AI 마음상담: 마음리포트와 마음체크 기록 통합
                                   - 심리검사 결과 / 상담·예약 내역은 기존 연결 유지
                                ===================================================== */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                    <button
                                        type="button"
                                        onClick={() => setMyRecordPanel('today')}
                                        className={`group text-left rounded-3xl border p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all ${myRecordPanel === 'today' ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-100 bg-white'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                                <Icon name="pencil" className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs font-extrabold text-emerald-700 bg-white border border-emerald-100 rounded-full px-3 py-1">
                                                {todayMindNotes.length}건
                                            </span>
                                        </div>
                                        <h3 className="mt-5 text-base font-extrabold text-slate-900">오늘의 마음</h3>
                                        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                                            오늘의 마음을 내 말로 직접 기록하고 다시 확인합니다.
                                        </p>
                                        <span className="inline-flex items-center mt-5 text-xs font-extrabold text-emerald-700">
                                            마음 기록하기 <Icon name="chevron-right" className="w-4 h-4 ml-1" />
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setMyRecordPanel('ai')}
                                        className={`group text-left rounded-3xl border p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all ${myRecordPanel === 'ai' ? 'border-amber-200 bg-amber-50/60' : 'border-slate-100 bg-white'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                                                <Icon name="message-square" className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs font-extrabold text-amber-700 bg-white border border-amber-100 rounded-full px-3 py-1">
                                                {mindRecords.length + userIntakeSummaries.length}건
                                            </span>
                                        </div>
                                        <h3 className="mt-5 text-base font-extrabold text-slate-900">AI 마음상담</h3>
                                        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                                            AI 마음리포트와 AI 마음체크 기록을 한곳에서 확인합니다.
                                        </p>
                                        <span className="inline-flex items-center mt-5 text-xs font-extrabold text-amber-700">
                                            상담 기록 보기 <Icon name="chevron-right" className="w-4 h-4 ml-1" />
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setMyRecordPanel('results')}
                                        className={`group text-left rounded-3xl border p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all ${myRecordPanel === 'results' ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-100 bg-white'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                                <Icon name="layout-list" className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs font-extrabold text-indigo-700 bg-white border border-indigo-100 rounded-full px-3 py-1">
                                                {getVisibleResultUploadsForCurrentUser().length + getApprovedReportsForCurrentUser().length}건
                                            </span>
                                        </div>
                                        <h3 className="mt-5 text-base font-extrabold text-slate-900">심리검사 결과</h3>
                                        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                                            승인된 검사결과와 결과보고서를 나의 마음기록에서 함께 확인합니다.
                                        </p>
                                        <span className="inline-flex items-center mt-5 text-xs font-extrabold text-indigo-700">
                                            결과·보고서 보기 <Icon name="chevron-right" className="w-4 h-4 ml-1" />
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setMyRecordPanel('reservations')}
                                        className={`group text-left rounded-3xl border p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all ${myRecordPanel === 'reservations' ? 'border-slate-300 bg-slate-100/70' : 'border-slate-100 bg-white'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                                                <Icon name="calendar" className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs font-extrabold text-slate-600 bg-slate-50 border border-slate-100 rounded-full px-3 py-1">
                                                {userReservations.length}건
                                            </span>
                                        </div>
                                        <h3 className="mt-5 text-base font-extrabold text-slate-900">상담·예약 내역</h3>
                                        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                                            상담 및 심리검사 예약 내역과 진행상황을 확인합니다.
                                        </p>
                                        <span className="inline-flex items-center mt-5 text-xs font-extrabold text-slate-700">
                                            예약·상담 보기 <Icon name="chevron-right" className="w-4 h-4 ml-1" />
                                        </span>
                                    </button>
                                </div>

                                {/* =====================================================
                                   [MOD-20260710-018] 오늘의 마음 직접 기록 / AI 마음상담 통합 기록
                                ===================================================== */}
                                <div className="mt-6 rounded-[2rem] border border-slate-100 bg-slate-50/70 p-5 sm:p-7">
                                    {myRecordPanel === 'reservations' ? (
                                        <div>
                                            <div className="mb-5">
                                                <h3 className="text-lg font-extrabold text-slate-900">상담·예약 내역</h3>
                                                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                                                    상담과 심리검사 예약 현황을 확인합니다. AI(비대면) 예약은 승인된 결과보고서를 바탕으로 글로 대화하는 채팅형 상담이며, 예약시간에 이곳에서 바로 시작할 수 있습니다.
                                                </p>
                                            </div>

                                            {userReservations.length ? (
                                                <div className="space-y-4">
                                                    {userReservations.map((reservation) => {
                                                        const isAiReservation =
                                                            reservation.type === 'AI(비대면)' ||
                                                            reservation.type === 'AI 비대면' ||
                                                            reservation.type === 'AI상담(비대면)' ||
                                                            reservation.type === 'AI 상담(비대면)' ||
                                                            reservation.aiCounseling === true ||
                                                            reservation.type === '비대면 전화/문자' ||
                                                            reservation.type === '전화 또는 문자(비대면)';

                                                        const aiState = isAiReservation
                                                            ? getAiReservationState(reservation)
                                                            : null;
                                                        const approvedReports = isAiReservation
                                                            ? getApprovedReportsForCurrentUser()
                                                            : [];
                                                        const hasApprovedReport = approvedReports.length > 0;
                                                        const isAiEnabled = reservation.aiResultCounselingEnabled === true;
                                                        const isAiCompleted = !!reservation.aiResultCounselingCompletedAt;
                                                        const canStartAi =
                                                            isAiReservation &&
                                                            isAiEnabled &&
                                                            !isAiCompleted &&
                                                            aiState?.status === 'available' &&
                                                            hasApprovedReport &&
                                                            reservation.status !== '예약취소';
                                                        const availableTestLinks = Object.entries(reservation.testLinks || {})
                                                            .filter(([, url]) => /^https?:\/\//i.test(String(url || '').trim()));
                                                        // [MOD-20260714-USER-PROGRAM-NAME]
                                                        // 사용자 예약내역에서는 프로그램명을 세 가지로만 표시합니다.
                                                        // 검사명은 아래 '검사명' 카드에서 별도로 표시합니다.
                                                        const rawProgramName = String(reservation.program || '').trim();
                                                        const programName = rawProgramName.includes('부모-자녀')
                                                            ? '부모-자녀 마음이음'
                                                            : rawProgramName.includes('부부')
                                                                ? '부부 마음이음'
                                                                : '개인 마음이음';
                                                        const testCandidates = [];
                                                        if (String(reservation.program || '').includes('부모-자녀')) testCandidates.push('STS', 'K-CDI', 'PAT', 'TCI');
                                                        else if (String(reservation.program || '').includes('부부')) testCandidates.push('TCI');
                                                        else if (String(reservation.program || '').includes('개인')) testCandidates.push('TCI');
                                                        const rawExtraTests = reservation.extraTests || reservation.selectedTests || reservation.additionalTests || [];
                                                        if (Array.isArray(rawExtraTests)) {
                                                            rawExtraTests.forEach((test) => {
                                                                const raw = String(test || '').toUpperCase();
                                                                if (raw.includes('MMPI')) testCandidates.push('MMPI-2');
                                                                else if (raw.includes('TCI')) testCandidates.push('TCI');
                                                                else if (raw.includes('PAI')) testCandidates.push('PAI');
                                                                else if (raw.includes('PAT')) testCandidates.push('PAT');
                                                                else if (raw.includes('STS')) testCandidates.push('STS');
                                                                else if (raw.includes('KCDI') || raw.includes('K-CDI')) testCandidates.push('K-CDI');
                                                                else if (raw.includes('SCT')) testCandidates.push('SCT');
                                                                else if (raw.includes('HTP')) testCandidates.push('HTP');
                                                                else if (raw.includes('PHQ')) testCandidates.push('PHQ-9');
                                                                else if (raw.includes('GAD')) testCandidates.push('GAD-7');
                                                                else if (raw.includes('회복탄력')) testCandidates.push('회복탄력성');
                                                                else if (String(test || '').trim()) testCandidates.push(String(test).replace(/\s*검사.*$/, '').trim());
                                                            });
                                                        }
                                                        const displayTests = [...new Set(testCandidates.filter(Boolean))];

                                                        return (
                                                            <article
                                                                key={reservation.id}
                                                                className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm"
                                                            >
                                                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                                                                    <div>
                                                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                                                            <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                                                                                isAiReservation
                                                                                    ? 'bg-violet-100 text-violet-700'
                                                                                    : 'bg-slate-100 text-slate-700'
                                                                            }`}>
                                                                                {isAiReservation ? 'AI(비대면)' : reservation.type}
                                                                            </span>
                                                                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700">
                                                                                {normalizeReservationStatus(reservation.status)}
                                                                            </span>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                                                            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                                                                                <p className="text-[10px] font-extrabold text-slate-400">예약일정</p>
                                                                                <p className="mt-1 text-sm font-extrabold text-slate-900">
                                                                                    {reservation.date} {reservation.time}
                                                                                    {isAiReservation && getAiReservationWindow(reservation)?.end
                                                                                        ? ` ~ ${getAiReservationWindow(reservation).end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
                                                                                        : ''}
                                                                                </p>
                                                                            </div>
                                                                            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                                                                                <p className="text-[10px] font-extrabold text-slate-400">프로그램명</p>
                                                                                <p className="mt-1 text-sm font-extrabold text-slate-900">{programName}</p>
                                                                            </div>
                                                                            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                                                                                <p className="text-[10px] font-extrabold text-slate-400">검사명</p>
                                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                                    {displayTests.length ? displayTests.map((test) => (
                                                                                        <span key={test} className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-1 text-[10px] font-extrabold text-indigo-700">{test}</span>
                                                                                    )) : <span className="text-xs font-bold text-slate-400">없음</span>}
                                                                                </div>
                                                                            </div>
                                                                            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                                                                                <p className="text-[10px] font-extrabold text-slate-400">상담방식</p>
                                                                                <p className="mt-1 text-sm font-extrabold text-slate-900">{reservation.type || '미정'}</p>
                                                                            </div>
                                                                        </div>

                                                                        {reservation.statusUpdateUnread && reservation.statusUpdatedAt && (
                                                                            <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                                                                <p className="text-xs font-extrabold text-blue-900">예약 진행상태가 변경되었습니다.</p>
                                                                                <p className="mt-1 text-xs leading-relaxed text-blue-800">
                                                                                    현재 상태: <strong>{normalizeReservationStatus(reservation.status)}</strong>
                                                                                </p>
                                                                                <p className="mt-1 text-xs leading-relaxed text-blue-700">
                                                                                    {getMemberStatusMessage(reservation.status)}
                                                                                </p>
                                                                                <p className="mt-1 text-[11px] text-blue-600">변경일: {reservation.statusUpdatedAt}</p>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => confirmStatusUpdate(reservation.id)}
                                                                                    className="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-[11px] font-extrabold text-white hover:bg-blue-800"
                                                                                >
                                                                                    진행상태 확인
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {reservation.scheduleUpdateUnread && reservation.scheduleUpdatedAt && (
                                                                            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                                                                <p className="text-xs font-extrabold text-amber-800">상담 일정이 변경되었습니다.</p>
                                                                                <p className="mt-1 text-xs leading-relaxed text-amber-700">
                                                                                    변경된 일정: {reservation.date} {reservation.time} · {reservation.type}
                                                                                </p>
                                                                                <p className="mt-1 text-[11px] text-amber-600">변경일: {reservation.scheduleUpdatedAt}</p>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => confirmScheduleUpdate(reservation.id)}
                                                                                    className="mt-3 rounded-xl bg-amber-700 px-4 py-2 text-[11px] font-extrabold text-white hover:bg-amber-800"
                                                                                >
                                                                                    변경 일정 확인
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {availableTestLinks.length > 0 && reservation.status !== '예약취소' && (
                                                                            <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                                                                                <p className="text-xs font-extrabold text-indigo-900">온라인 심리검사 링크</p>
                                                                                <p className="mt-1 text-[11px] leading-relaxed text-indigo-700">아래 검사명을 눌러 검사를 진행해 주세요. 검사 완료 후 담당자에게 알려주세요.</p>
                                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                                    {availableTestLinks.map(([testName, url]) => (
                                                                                        <a
                                                                                            key={testName}
                                                                                            href={String(url)}
                                                                                            target="_blank"
                                                                                            rel="noreferrer"
                                                                                            className="rounded-xl bg-indigo-700 px-4 py-2 text-[11px] font-extrabold text-white hover:bg-indigo-800"
                                                                                        >
                                                                                            {testName} 시작
                                                                                        </a>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {isAiReservation && (
                                                                            <div className="mt-2 space-y-1 text-xs text-slate-500">
                                                                                <p>결과보고서: {hasApprovedReport ? '검토·승인 완료' : '승인 대기'}</p>
                                                                                <p>AI 결과상담: {isAiCompleted ? '상담 완료' : isAiEnabled ? '관리자 활성화 완료' : '관리자 활성화 대기'}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex flex-wrap gap-2">
                                                                        {isAiReservation ? (
                                                                            <button
                                                                                type="button"
                                                                                disabled={!canStartAi}
                                                                                onClick={() => startAiResultCounseling(reservation)}
                                                                                className={`rounded-2xl px-5 py-3 text-xs font-extrabold transition ${
                                                                                    canStartAi
                                                                                        ? 'bg-violet-700 text-white hover:bg-violet-800 shadow-md ring-2 ring-violet-100'
                                                                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                                }`}
                                                                            >
                                                                                {isAiCompleted
                                                                                    ? 'AI 상담 완료'
                                                                                    : !isAiEnabled
                                                                                        ? '관리자 활성화 대기'
                                                                                        : aiState?.status === 'before'
                                                                                            ? '예약시간에 이용할 수 있습니다'
                                                                                            : aiState?.status === 'ended'
                                                                                                ? 'AI 상담이 종료되었습니다'
                                                                                                : !hasApprovedReport
                                                                                                    ? '결과보고서 승인 대기'
                                                                                                    : `AI 상담 시작 · ${formatRemainingTime(aiState.remainingMs)}`}
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => scrollToSection('reservations')}
                                                                                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                                                                            >
                                                                                예약 상세 보기
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </article>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
                                                    <p className="text-sm font-bold text-slate-700">예약 내역이 없습니다.</p>
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        상담 또는 심리검사를 신청하면 예약 내역이 이곳에 표시됩니다.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : myRecordPanel === 'results' ? (
                                        <div>
                                            <div className="mb-5">
                                                <h3 className="text-lg font-extrabold text-slate-900">심리검사 결과와 결과보고서</h3>
                                                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                                                    임상심리사가 검토·승인한 검사결과와 결과보고서를 이곳에서 함께 확인할 수 있습니다.
                                                </p>
                                            </div>

                                            {(!currentName && !currentPhone) ? (
                                                <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                                    <p className="text-sm font-extrabold text-amber-900">회원정보 확인이 필요합니다.</p>
                                                    <p className="mt-2 text-xs leading-relaxed text-amber-800">
                                                        현재 로그인 정보에 이름과 연락처가 없어 검사결과를 연결할 수 없습니다. 로그아웃한 뒤 예약 시 사용한 이름과 연락처로 다시 로그인해 주세요.
                                                    </p>
                                                </div>
                                            ) : null}

                                            {(getVisibleResultUploadsForCurrentUser().length || getApprovedReportsForCurrentUser().length) ? (
                                                <div className="space-y-6">
                                                    {getVisibleResultUploadsForCurrentUser().length ? (
                                                        <div>
                                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                                <h4 className="text-sm font-extrabold text-slate-800">검사결과 파일</h4>
                                                                <span className="text-[11px] font-bold text-indigo-600">관리자 공개 승인</span>
                                                            </div>
                                                            <div className="space-y-4">
                                                                {getVisibleResultUploadsForCurrentUser().map((upload) => (
                                                                    <article
                                                                        key={upload.id || `${upload.clientName}-${upload.createdAt}`}
                                                                        className="rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 shadow-sm"
                                                                    >
                                                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                                                                            <div>
                                                                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                                                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-extrabold text-emerald-700">
                                                                                        {upload.testType || '심리검사'}
                                                                                    </span>
                                                                                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-extrabold text-indigo-700">
                                                                                        검사결과 공개
                                                                                    </span>
                                                                                </div>
                                                                                <h4 className="text-base font-extrabold text-slate-900">
                                                                                    {upload.fileName || '심리검사 결과 파일'}
                                                                                </h4>
                                                                                <p className="mt-2 text-xs text-slate-500">
                                                                                    등록일: {upload.createdAt || '확인 필요'}
                                                                                </p>
                                                                                {upload.summary ? (
                                                                                    <p className="mt-3 max-w-3xl whitespace-pre-line text-xs leading-relaxed text-slate-600">
                                                                                        {upload.summary}
                                                                                    </p>
                                                                                ) : null}
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openUploadedResult(upload)}
                                                                                className="rounded-2xl bg-emerald-700 px-5 py-3 text-xs font-extrabold text-white hover:bg-emerald-800"
                                                                            >
                                                                                검사결과 파일 보기
                                                                            </button>
                                                                        </div>
                                                                    </article>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    {getApprovedReportsForCurrentUser().length ? (
                                                        <div>
                                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                                <h4 className="text-sm font-extrabold text-slate-800">결과보고서</h4>
                                                                <span className="text-[11px] font-bold text-emerald-600">임상심리사 검토·승인</span>
                                                            </div>
                                                            <div className="space-y-4">
                                                    {getApprovedReportsForCurrentUser().map((report) => (
                                                        <article
                                                            key={report.id || `${report.clientName}-${report.createdAt}`}
                                                            className="rounded-3xl border border-indigo-100 bg-white p-5 sm:p-6 shadow-sm"
                                                        >
                                                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                                                                <div>
                                                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                                                        <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-extrabold text-indigo-700">
                                                                            {report.testType || '심리검사'}
                                                                        </span>
                                                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-extrabold text-emerald-700">
                                                                            검토·승인 완료
                                                                        </span>
                                                                    </div>
                                                                    <h4 className="text-base font-extrabold text-slate-900">
                                                                        {report.title || '심리검사 결과보고서'}
                                                                    </h4>
                                                                    <p className="mt-2 text-xs text-slate-500">
                                                                        검사일: {report.testDate || report.createdAt || '확인 필요'}
                                                                    </p>
                                                                </div>

                                                                <div className="flex flex-wrap gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedReport(report);
                                                                            setShowReport(true);
                                                                        }}
                                                                        className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-xs font-extrabold text-indigo-700 hover:bg-indigo-100"
                                                                    >
                                                                        검사결과 보기
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedReport(report);
                                                                            setShowReport(true);
                                                                        }}
                                                                        className="rounded-2xl bg-slate-900 px-5 py-3 text-xs font-extrabold text-white hover:bg-slate-800"
                                                                    >
                                                                        결과보고서 보기
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </article>
                                                    ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
                                                    <p className="text-sm font-bold text-slate-700">확인 가능한 심리검사 결과가 없습니다.</p>
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        임상심리사의 검토와 승인이 완료되면 검사결과와 결과보고서가 이곳에 표시됩니다.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : myRecordPanel === 'today' ? (
                                        <div>
                                            <div className="mb-5">
                                                <h3 className="text-lg font-extrabold text-slate-900">오늘의 마음</h3>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    지금 떠오르는 마음을 평가하지 말고 편한 말로 적어 보세요.
                                                </p>
                                            </div>

                                            <div className="rounded-3xl border border-emerald-100 bg-white p-5">
                                                <textarea
                                                    value={todayMindInput}
                                                    onChange={(e) => setTodayMindInput(e.target.value)}
                                                    rows={5}
                                                    placeholder="오늘 어떤 마음이 가장 오래 머물렀나요?"
                                                    className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-relaxed outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                                                />
                                                <div className="mt-4 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={saveTodayMindNote}
                                                        className="rounded-full bg-emerald-700 px-6 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-800"
                                                    >
                                                        마음 기록하기
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-6">
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                                                    <h4 className="text-sm font-extrabold text-slate-800">나의 기록</h4>
                                                    <div className="flex flex-col sm:flex-row gap-2 sm:w-auto w-full">
                                                        <input
                                                            type="search"
                                                            value={todayMindSearch}
                                                            onChange={(e) => setTodayMindSearch(e.target.value)}
                                                            placeholder="마음기록 검색"
                                                            className="w-full sm:w-56 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                                                        />
                                                        <select
                                                            value={todayMindSort}
                                                            onChange={(e) => setTodayMindSort(e.target.value)}
                                                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 outline-none focus:border-emerald-400"
                                                        >
                                                            <option value="newest">최신순</option>
                                                            <option value="oldest">오래된순</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* =====================================================
                                                   [MOD-20260710-031] 오늘의 마음 검색 결과 표시
                                                ===================================================== */}
                                                {filteredTodayMindNotes.length === 0 ? (
                                                    <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-8 text-center">
                                                        <p className="text-sm font-extrabold text-slate-700">
                                                            {todayMindSearch ? '검색된 마음기록이 없습니다.' : '아직 기록이 없습니다.'}
                                                        </p>
                                                        <p className="mt-2 text-xs text-slate-400">
                                                            {todayMindSearch ? '다른 검색어로 다시 찾아보세요.' : '오늘의 마음을 적으면 이곳에 차곡차곡 저장됩니다.'}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {filteredTodayMindNotes.map((note) => (
                                                            <article key={note.id} className="rounded-3xl border border-slate-100 bg-white p-5">
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <div>
                                                                        <p className="text-xs font-bold text-emerald-700">{note.createdAt}</p>
                                                                        {note.updatedAt && (
                                                                            <p className="mt-1 text-[11px] text-slate-400">수정됨 · {note.updatedAt}</p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {editingTodayMindId !== note.id && (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => startEditTodayMindNote(note)}
                                                                                    className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-extrabold text-slate-600 hover:bg-slate-50"
                                                                                >
                                                                                    수정
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => deleteTodayMindNote(note.id)}
                                                                                    className="rounded-full border border-rose-200 px-3 py-1.5 text-[11px] font-extrabold text-rose-600 hover:bg-rose-50"
                                                                                >
                                                                                    삭제
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {editingTodayMindId === note.id ? (
                                                                    <div className="mt-4">
                                                                        <textarea
                                                                            value={editingTodayMindText}
                                                                            onChange={(e) => setEditingTodayMindText(e.target.value)}
                                                                            rows={5}
                                                                            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-relaxed outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                                                                        />
                                                                        <div className="mt-3 flex justify-end gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={cancelEditTodayMindNote}
                                                                                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
                                                                            >
                                                                                취소
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={saveEditedTodayMindNote}
                                                                                className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-800"
                                                                            >
                                                                                저장
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{note.text}</p>
                                                                )}
                                                            </article>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                                                <div>
                                                    <h3 className="text-lg font-extrabold text-slate-900">AI 마음상담</h3>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        AI 마음리포트와 AI 마음체크 기록을 함께 확인합니다.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* =====================================================
                                                   [MOD-20260710-022] 기록 화면 바로가기 버튼 삭제
                                                   - AI 마음리포트 바로가기 삭제
                                                   - AI 마음체크 바로가기 삭제
                                                   - 기록 확인 기능만 유지
                                                ===================================================== */}
                                                {/* =====================================================
                                                   [MOD-20260710-026] AI 마음상담 기록 탭 적용
                                                   - AI 마음리포트 / AI 마음체크를 한 화면에서 탭으로 구분
                                                   - 기존 기록 보기 기능은 그대로 유지
                                                   - 바로가기 버튼은 추가하지 않음
                                                ===================================================== */}
                                                <div className="rounded-3xl border border-slate-100 bg-white p-4 sm:p-5">
                                                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 mb-5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAiCounselingRecordTab('report')}
                                                            className={`rounded-xl px-4 py-3 text-xs font-extrabold transition-all ${
                                                                aiCounselingRecordTab === 'report'
                                                                    ? 'bg-white text-emerald-700 shadow-sm'
                                                                    : 'text-slate-500 hover:text-slate-700'
                                                            }`}
                                                        >
                                                            AI 마음리포트 · {mindRecords.length}건
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAiCounselingRecordTab('check')}
                                                            className={`rounded-xl px-4 py-3 text-xs font-extrabold transition-all ${
                                                                aiCounselingRecordTab === 'check'
                                                                    ? 'bg-white text-amber-700 shadow-sm'
                                                                    : 'text-slate-500 hover:text-slate-700'
                                                            }`}
                                                        >
                                                            AI 마음체크 · {userIntakeSummaries.length}건
                                                        </button>
                                                    </div>

                                                    {/* =====================================================
                                                       [MOD-20260710-029] AI 기록 검색창·정렬 선택
                                                    ===================================================== */}
                                                    <div className="mb-5 flex flex-col sm:flex-row gap-3">
                                                        <input
                                                            type="search"
                                                            value={aiRecordSearch}
                                                            onChange={(e) => setAiRecordSearch(e.target.value)}
                                                            placeholder="기록 내용 검색"
                                                            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                                                        />
                                                        <select
                                                            value={aiRecordSort}
                                                            onChange={(e) => setAiRecordSort(e.target.value)}
                                                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:border-emerald-400"
                                                        >
                                                            <option value="newest">최신순</option>
                                                            <option value="oldest">오래된순</option>
                                                        </select>
                                                    </div>

                                                    {aiCounselingRecordTab === 'report' ? (
                                                        <section>
                                                            <div className="mb-4">
                                                                <h4 className="text-sm font-extrabold text-slate-900">AI 마음리포트</h4>
                                                                <p className="mt-1 text-xs text-slate-400">짧게 작성한 마음을 AI가 정리한 기록</p>
                                                            </div>

                                                            {filteredMindRecords.length === 0 ? (
                                                                <div className="rounded-2xl border border-dashed border-emerald-200 p-8 text-center">
                                                                    <p className="text-xs font-bold text-slate-500">{aiRecordSearch ? '검색된 마음리포트가 없습니다.' : '아직 마음리포트가 없습니다.'}</p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-3">
                                                                    {filteredMindRecords.map((record) => (
                                                                        <details key={record.id} className="rounded-2xl border border-slate-100 p-4">
                                                                            <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                                                                                <div className="min-w-0">
                                                                                    <p className="text-xs font-bold text-emerald-700">
                                                                                        {record.createdAt || '기록일 미확인'}
                                                                                    </p>
                                                                                    <p className="mt-1 truncate text-sm font-extrabold text-slate-900">
                                                                                        {record.input || 'AI 마음리포트'}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 shrink-0">
                                                                                    <span className="text-xs font-bold text-slate-400">보기</span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            deleteMindReportRecord(record.id);
                                                                                        }}
                                                                                        className="rounded-full border border-rose-200 px-3 py-1.5 text-[11px] font-extrabold text-rose-600 hover:bg-rose-50"
                                                                                    >
                                                                                        삭제
                                                                                    </button>
                                                                                </div>
                                                                            </summary>
                                                                            <div className="mt-4 border-t border-slate-100 pt-4">
                                                                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                                                                                    {getCleanMindReportText(record.result)}
                                                                                </p>
                                                                            </div>
                                                                        </details>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </section>
                                                    ) : (
                                                        <section>
                                                            <div className="mb-4">
                                                                <h4 className="text-sm font-extrabold text-slate-900">AI 마음체크</h4>
                                                                <p className="mt-1 text-xs text-slate-400">AI 마음지기와 대화하고 마음을 정리한 기록</p>
                                                            </div>

                                                            {filteredAiIntakeRecords.length === 0 ? (
                                                                <div className="rounded-2xl border border-dashed border-amber-200 p-8 text-center">
                                                                    <p className="text-xs font-bold text-slate-500">{aiRecordSearch ? '검색된 마음체크 기록이 없습니다.' : '아직 마음체크 기록이 없습니다.'}</p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-3">
                                                                    {filteredAiIntakeRecords.map((record) => (
                                                                        <details key={record.id} className="rounded-2xl border border-slate-100 p-4">
                                                                            <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                                                                                <div className="min-w-0">
                                                                                    <p className="text-xs font-bold text-amber-700">
                                                                                        {record.date || '기록일 미확인'}
                                                                                    </p>
                                                                                    <p className="mt-1 truncate text-sm font-extrabold text-slate-900">
                                                                                        {record.mainConcern || record.theme?.label || 'AI 마음체크'}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 shrink-0">
                                                                                    <span className="text-xs font-bold text-slate-400">보기</span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            deleteAiIntakeRecord(record.id);
                                                                                        }}
                                                                                        className="rounded-full border border-rose-200 px-3 py-1.5 text-[11px] font-extrabold text-rose-600 hover:bg-rose-50"
                                                                                    >
                                                                                        삭제
                                                                                    </button>
                                                                                </div>
                                                                            </summary>
                                                                            <div className="mt-4 border-t border-slate-100 pt-4">
                                                                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                                                                                    {record.mindReflection || record.summary || '저장된 마음정리를 확인할 수 없습니다.'}
                                                                                </p>
                                                                            </div>
                                                                        </details>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </section>
                                                    )}
                                                </div>
                                        </div>
                                    )}
                                </div>

                                {!isLoggedIn && !currentUser && (
                                    <div className="mt-6 rounded-3xl bg-amber-50 border border-amber-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <p className="text-sm text-amber-900 font-bold">AI 마음체크 예약 진행을 위해 회원가입 또는 로그인이 필요합니다.</p>
                                        <button onClick={() => { setAuthMode('signup'); setIsAuthModalOpen(true); }} className="bg-slate-900 text-white rounded-full px-5 py-3 text-sm font-bold">회원가입하기</button>
                                    </div>
                                )}
                            </div>
                        </section>
                        )}

                        <section id="mind-records" style={{display:'none'}} className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
                            <div className="max-w-5xl mx-auto">
                                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                                    <div>
                                        <span className="inline-block text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full mb-3">
                                            상담 이용자 전용
                                        </span>
                                        <h2 className="text-3xl font-extrabold text-slate-900">마음성장 기록</h2>
                                        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                                            검사신청·결제 또는 심리검사 예약 확정 후 열리는 상담 이용자 전용 마음기록입니다. 기록은 상담 전후 마음 흐름을 이해하는 자료로 연결됩니다.
                                        </p>
                                    </div>
                                    {mindRecords.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm('저장된 마음기록을 모두 삭제할까요?')) {
                                                    localStorage.removeItem('modumam_mind_records');
                                                    setMindRecords([]);
                                                }
                                            }}
                                            className="text-xs font-bold text-slate-500 border border-slate-200 rounded-full px-4 py-2 hover:bg-slate-50"
                                        >
                                            기록 전체삭제
                                        </button>
                                    )}
                                </div>

                                {!hasPaidAccess ? (
                                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                                        <p className="text-sm font-extrabold text-slate-700">마음기록은 상담 이용자 전용 기능입니다.</p>
                                        <p className="text-xs text-slate-400 mt-2">AI 마음 상담 후 추천 검사 또는 상담을 신청·결제하면 마음성장 공간이 열립니다.</p>
                                    </div>
                                ) : mindRecords.length === 0 ? (
                                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
                                        아직 저장된 마음기록이 없습니다. ‘AI 마음상담’에서 마음리포트 또는 AI 마음체크를 이용해 보세요.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {mindRecords.map((record) => (
                                            <article key={record.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5 shadow-sm">
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-black text-lg font-mono">
                                                            {record.punctuation}
                                                        </span>
                                                        <div>
                                                            <p className="text-sm font-extrabold text-slate-900">마음리포트</p>
                                                            <p className="text-xs text-slate-400">{record.createdAt}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-xs font-bold text-slate-500 mb-2">작성한 마음</p>
                                                <p className="text-sm text-slate-600 bg-white rounded-2xl p-4 border border-slate-100 line-clamp-3 whitespace-pre-line">
                                                    {record.input}
                                                </p>
                                                <p className="text-xs font-bold text-emerald-700 mt-4 mb-2">AI 마음정리</p>
                                                <p className="text-sm text-slate-700 bg-white rounded-2xl p-4 border border-slate-100 line-clamp-5 whitespace-pre-line">
                                                    {record.result}
                                                </p>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        <section id="tests" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-slate-100">
                            <div className="max-w-7xl mx-auto">
                                <div className="text-center max-w-3xl mx-auto mb-14">
                                    <span className="inline-block text-xs font-bold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full mb-3">
                                        정교한 마음 설계도
                                    </span>
                                    <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">심리검사와 프로그램</h2>
                                    <p className="mt-4 text-slate-500 text-sm sm:text-base">
                                        먼저 나에게 필요한 심리검사를 확인하고, 아래에서 마음이음 프로그램을 선택해 예약으로 이어갈 수 있습니다.
                                    </p>
                                </div>

                                <div className="space-y-10">
                                    {/* 왼쪽: 심리검사 */}
                                    <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-xl">
                                        <div className="flex items-start justify-between gap-4 mb-8">
                                            <div>
                                                <span className="inline-flex items-center text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full mb-3">
                                                    심리검사
                                                </span>
                                                <h3 className="text-2xl font-extrabold text-slate-900 flex items-center">
                                                    <Icon name="help-circle" className="w-5 h-5 mr-2 text-indigo-500 shrink-0" />
                                                    나에게 필요한 검사는 뭘까요?
                                                </h3>
                                                <p className="text-sm text-slate-500 mt-2">
                                                    대상과 고민을 선택하면 적합한 검사 조합을 추천해드립니다.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                                            <div className="lg:col-span-5 bg-slate-50 rounded-3xl p-5 sm:p-6 border border-slate-100">
                                                <div className="mb-5">
                                                    <h4 className="text-base font-extrabold text-slate-900">대상 및 고민 선택</h4>
                                                    <p className="text-xs text-slate-400 mt-1">현재 상황에 가까운 항목을 골라주세요.</p>
                                                </div>

                                                <div className="space-y-5">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                            대상 구분
                                                        </label>
                                                        <select
                                                            value={userAge}
                                                            onChange={(e) => {
                                                                const target = e.target.value;
                                                                setUserAge(target);
                                                                if (target === "parent") {
                                                                    setUserWorry("development");
                                                                } else {
                                                                    setUserWorry("character");
                                                                }
                                                            }}
                                                            className="w-full bg-white px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        >
                                                            <option value="adult">일반 또는 직장인</option>
                                                            <option value="teen">청소년</option>
                                                            <option value="parent">부모 또는 양육자</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                            가장 고민되는 주제
                                                        </label>
                                                        <select
                                                            value={userWorry}
                                                            onChange={(e) => setUserWorry(e.target.value)}
                                                            className="w-full bg-white px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        >
                                                            {userAge === "parent" ? (
                                                                <>
                                                                    <option value="development">발달 및 부모-자녀 관계</option>
                                                                    <option value="character">기질 및 성격 특성</option>
                                                                    <option value="emotion">불안·우울 등 정신적 피로</option>
                                                                    <option value="relationship">대인관계 및 소통 어려움</option>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <option value="character">기질 및 성격 특성</option>
                                                                    <option value="emotion">불안·우울 등 정신적 피로</option>
                                                                    <option value="relationship">대인관계 및 소통 어려움</option>
                                                                    <option value="meaning">인생의 깊은 의미 성찰</option>
                                                                    <option value="resilience">스트레스 극복 및 멘탈 강인성</option>
                                                                    {userAge === "teen" && (
                                                                        <option value="career">학습·진로</option>
                                                                    )}
                                                                </>
                                                            )}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="lg:col-span-7 bg-indigo-50/70 rounded-3xl p-5 sm:p-6 border border-indigo-100/60 flex flex-col justify-between">
                                                <div>
                                                    <div className="mb-4">
                                                        <h4 className="text-base font-extrabold text-slate-900">추천 검사 조합</h4>
                                                        <p className="text-xs text-slate-400 mt-0.5">선택하신 대상과 고민 주제에 따른 추천 검사입니다.</p>
                                                    </div>

                                                    <div className="space-y-2 mt-4">
                                                        {recommendedTests && recommendedTests.length > 0 ? (
                                                            recommendedTests.map((test) => {
                                                                const isMindSarange = test.includes("마음사랑");
                                                                const cleanName = test
                                                                    .replace(" (마음사랑)", "")
                                                                    .replace(" (인싸이트)", "");

                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={test}
                                                                        onClick={() => setSelectedTestPopup(getRecommendedTestInfo(test))}
                                                                        className="w-full flex items-center justify-between bg-white border border-indigo-100/60 rounded-xl px-4 py-3 shadow-sm text-left hover:border-indigo-300 hover:shadow-md transition"
                                                                        title="검사 설명 보기"
                                                                    >
                                                                        <span className="text-sm font-semibold text-slate-700">
                                                                            {cleanName}
                                                                            <span className="ml-2 text-[10px] font-bold text-indigo-500">설명보기</span>
                                                                        </span>
                                                                        <span
                                                                            className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                                                                                isMindSarange
                                                                                    ? "bg-indigo-100 text-indigo-700"
                                                                                    : "bg-emerald-100 text-emerald-700"
                                                                            }`}
                                                                        >
                                                                            {isMindSarange ? "마음사랑" : "인싸이트"}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="text-center py-8 text-sm text-slate-400 bg-white/50 rounded-xl border border-dashed border-slate-200">
                                                                추천된 검사 조합이 없습니다.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-6">
                                                    <button 
                                                        onClick={() => {
                                                            if (recommendedTests && recommendedTests.length > 0) {
                                                                setBookingProgram(`개인 마음이음 - ${recommendedTests.join(", ")}`);
                                                            } else {
                                                                setBookingProgram(`개인 마음이음 - 맞춤 심리검사`);
                                                            }
                                                            scrollToSection("reservations");
                                                        }}
                                                        className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md text-sm"
                                                    >
                                                        검사 신청 및 예약하기
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2행: 프로그램 */}
                                    <div className="pt-4">
                                        <div className="text-center max-w-3xl mx-auto mb-10">
                                            <span className="inline-flex items-center text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full mb-3">
                                                체계적인 맞춤 치유 경로
                                            </span>
                                            <h3 className="text-3xl font-extrabold text-slate-900">모두맘 프로그램</h3>
                                            <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                                                심리검사 결과를 바탕으로 전문가 해석상담과 마음이음 과정을 연결합니다.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
                                            {programs.map((prog) => (
                                                <article key={prog.id} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all">
                                                    <div className="relative h-44 bg-emerald-50 flex items-center justify-center overflow-hidden">
                                                        <img src={prog.img} alt={prog.title} className="w-full h-full object-cover" />
                                                        <span className="absolute top-4 right-4 bg-emerald-50 text-emerald-700 rounded-full px-3 py-1 text-[10px] font-bold border border-emerald-100 shadow-sm">
                                                            ⭐ 만족도 98%
                                                        </span>
                                                    </div>

                                                    <div className="p-6 sm:p-7">
                                                        <div className="flex justify-end -mt-10 mb-5">
                                                            <span className="bg-indigo-50 text-indigo-700 rounded-full px-4 py-2 text-[11px] font-extrabold border border-indigo-100 shadow-sm">
                                                                {prog.badge}
                                                            </span>
                                                        </div>

                                                        <h4 className="text-xl font-extrabold text-slate-900">
                                                            {prog.title}
                                                            {prog.subtitle && (
                                                                <span className="block text-xs font-semibold text-slate-400 mt-1.5">{prog.subtitle}</span>
                                                            )}
                                                        </h4>

                                                        <p className="text-sm text-slate-500 leading-relaxed mt-4 min-h-[72px]">{prog.desc}</p>

                                                        <div className="mt-6 pt-5 border-t border-slate-100">
                                                            <strong className="block text-xs text-slate-800 font-bold mb-2">이런 분께 추천합니다</strong>
                                                            <span className="text-xs text-slate-500 leading-6 block whitespace-pre-line min-h-[96px]">{prog.target}</span>

                                                            <button
                                                                onClick={() => {
                                                                    let programValue = "개인 마음이음";

                                                                    if (prog.title.includes("부모-자녀")) {
                                                                        programValue = "부모-자녀 마음이음";
                                                                    }

                                                                    if (prog.title.includes("부부")) {
                                                                        programValue = "부부 마음이음";
                                                                    }

                                                                    setBookingProgram(programValue);
                                                                    setSelectedTests([]);
                                                                    setTimeout(() => scrollToSection('reservations'), 0);
                                                                }}
                                                                className="mt-6 w-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold px-6 py-3.5 rounded-2xl transition-all shadow-sm"
                                                            >
                                                                신청하기
                                                            </button>
                                                        </div>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    </div>                                </div>
                            </div>
                        </section>

{/* [MOD-20260714] 공개 예약페이지의 개인 예약현황 삭제: 예약내역은 로그인 후 나의 마음기록에서만 표시 */}
<section id="reservations" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
<div className="max-w-7xl mx-auto">
<div className="text-center max-w-3xl mx-auto mb-16">
    <span className="inline-block text-xs font-bold bg-slate-900 text-white px-3 py-1 rounded-full mb-3">
        마음이 머무르는 시간
    </span>
    <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">심리검사 예약</h2>
    <p className="mt-4 text-slate-500 text-sm sm:text-base">
        심리검사와 해석상담을 함께 예약합니다. 대면 또는 비대면 방식으로 현재 마음을 이해하는 과정을 시작해 보세요.<br />
        ※ 간편 예약을 신청하시면 내용 확인 후 순차적으로 연락을 드려 상세 일정을 안내해 드립니다.
    </p>
</div>

<div className="max-w-3xl mx-auto">
    {/* 예약 신청서 */}
    <div className="bg-slate-50 p-6 sm:p-8 rounded-3xl border border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <Icon name="calendar" className="w-5 h-5 mr-2 text-slate-800" />
            간편 예약 신청
        </h3>

        {bookingAlert && (
            <div className={`p-4 rounded-xl mb-6 text-xs font-semibold ${bookingAlert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                {bookingAlert.message}
            </div>
        )}

        <form onSubmit={handleAddBooking} className="space-y-4">
            {/* 1. 신청 프로그램 선택 */}
<div>
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        신청 프로그램
    </label>

    <select 
        value={bookingProgram}
        onChange={(e) => {
            const program = e.target.value;
            setBookingProgram(program);
            setSelectedTests([]);
            // [MOD-20260712-PARENT-BOOKING-009]
            // 행동관찰을 새로 선택하기 전에는 찾아가는(대면)을 사용할 수 없습니다.
            if (bookingType === '찾아가는(대면)') {
                setBookingType('장소 조율(대면)');
            }
        }}
        className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
    >
        <option value="개인 마음이음">개인 마음이음</option>
        <option value="부모-자녀 마음이음">부모-자녀 마음이음</option>
        <option value="부부 마음이음">부부 마음이음</option>
    </select>

    {/* =====================================================
       [MOD-20260712-PARENT-BOOKING-010] 모든 프로그램 공통 안내
       - 개인/부부/부모-자녀 선택과 관계없이 항상 표시
    ===================================================== */}
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-600">
        <p>※ 기본검사는 프로그램에 포함되어 있으며, 추가검사는 필요에 따라 선택하실 수 있습니다.</p>
        <p className="mt-1">※ 찾아가는(대면) 상담은 부모-자녀 마음이음의 '행동관찰'을 선택한 경우에만 신청할 수 있습니다.</p>
    </div>
</div>
            
           {/* 2. 추가 검사 선택 (조건부) */}

{/* 개인 마음이음 */}
{bookingProgram.includes("개인 마음이음") && (
  <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
    <p className="text-xs font-bold text-slate-700 mb-3">
      개인 마음이음 기본 검사
    </p>

    <div className="grid grid-cols-1 gap-2 mb-3">
      {[
        "TCI 기질 및 성격검사(기본)"
      ].map((test) => (
        <div key={test} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-white">
          <span className="text-emerald-600 text-xs font-bold">✓</span>
          <span className="text-xs text-slate-700 font-semibold">{test}</span>
        </div>
      ))}
    </div>


    <p className="text-xs font-bold text-slate-700 mb-3">
      유료 추가검사 (+30,000원/건)
    </p>
    <div className="grid grid-cols-2 gap-2 mb-4">
      {[
        "MMPI-2 다면적 인성검사",
        "회복탄력성 검사",
        "대인관계문제검사",
        "직무스트레스 검사",
        "진로·직업흥미 검사"
      ].map((test) => (
        <label key={test} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer border border-slate-100 bg-white">
          <input
            type="checkbox"
            checked={selectedTests.includes(test)}
            onChange={() => toggleTest(test)}
          />
          <span className="text-xs text-slate-700">{test}</span>
        </label>
      ))}
    </div>

    <p className="text-xs font-bold text-slate-700 mb-3">
      무료 추가검사
    </p>
    <div className="grid grid-cols-2 gap-2">
      {[
        "문장완성검사(무료)",
        "집-나무-사람 그림검사(무료)",
        "우울검사(무료)",
        "불안검사(무료)",
        "스트레스검사(무료)"
      ].map((test) => (
        <label key={test} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer border border-slate-100 bg-white">
          <input
            type="checkbox"
            checked={selectedTests.includes(test)}
            onChange={() => toggleTest(test)}
          />
          <span className="text-xs text-slate-700">{test}</span>
        </label>
      ))}
    </div>
  </div>
)}

{/* 부모-자녀 마음이음 */}
{bookingProgram.includes("부모-자녀 마음이음") && (
  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
    <p className="text-xs font-bold text-emerald-700 mb-3">
      부모-자녀 마음이음 기본 검사
    </p>

    <div className="grid grid-cols-1 gap-2 mb-4">
      {[
        "PAT 부모양육태도검사(기본)",
        "KCDI 아동발달검사(기본)"
      ].map((test) => (
        <div key={test} className="flex items-center gap-2 p-2 rounded-lg border border-emerald-100 bg-white">
          <span className="text-emerald-600 text-xs font-bold">✓</span>
          <span className="text-xs text-slate-700 font-semibold">{test}</span>
        </div>
      ))}
    </div>

    <p className="text-xs font-bold text-emerald-700 mb-3">
      유료 추가검사 (+30,000원/건)
    </p>

    <div className="grid grid-cols-2 gap-2">
      {[
        "행동관찰",
        "STS 기질검사",
        "부모 TCI 기질 및 성격검사"
      ].map((test) => (
        <label key={test} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer border border-emerald-100 bg-white">
          <input
            type="checkbox"
            checked={selectedTests.includes(test)}
            onChange={() => {
                // [MOD-20260712-PARENT-BOOKING-011]
                // 행동관찰 선택 시 찾아가는(대면)으로 자동 변경하고,
                // 행동관찰 해제 시 장소 조율(대면)으로 되돌립니다.
                if (test === '행동관찰') {
                    const willSelect = !selectedTests.includes(test);
                    toggleTest(test);
                    setBookingType(willSelect ? '찾아가는(대면)' : '장소 조율(대면)');
                    return;
                }
                toggleTest(test);
            }}
          />
          <span className="text-xs text-slate-700">{test}</span>
        </label>
      ))}
    </div>
  </div>
)}

{/* 부부 마음이음 */}
{bookingProgram.includes("부부 마음이음") && (
  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
    <p className="text-xs font-bold text-blue-700 mb-3">
      부부 마음이음 기본 검사
    </p>

    <div className="grid grid-cols-1 gap-2 mb-3">
      {[
        "본인 TCI 기질 및 성격검사(기본)",
        "배우자 TCI 기질 및 성격검사(기본)"
      ].map((test) => (
        <div key={test} className="flex items-center gap-2 p-2 rounded-lg border border-blue-100 bg-white">
          <span className="text-emerald-600 text-xs font-bold">✓</span>
          <span className="text-xs text-slate-700 font-semibold">{test}</span>
        </div>
      ))}
    </div>


    <p className="text-xs font-bold text-blue-700 mb-3">
      유료 추가검사 (+30,000원/건)
    </p>

    <div className="grid grid-cols-2 gap-2">
      {[
        "MMPI-2 다면적 인성검사",
        "회복탄력성 검사",
        "대인관계문제검사"
      ].map((test) => (
        <label key={test} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer border border-blue-100 bg-white">
          <input
            type="checkbox"
            checked={selectedTests.includes(test)}
            onChange={() => toggleTest(test)}
          />
          <span className="text-xs text-slate-700">{test}</span>
        </label>
      ))}
    </div>
  </div>
)}
            {/* 3. 상담 방식 선택 */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">상담 방식 선택</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                    <button
                        type="button"
                        disabled={hasBehaviorObservation}
                        onClick={() => { if (!hasBehaviorObservation) setBookingType('장소 조율(대면)'); }}
                        className={`p-3 rounded-xl border text-center transition-all ${hasBehaviorObservation ? 'border-slate-100 bg-slate-100 text-slate-300 cursor-not-allowed' : bookingType === '장소 조율(대면)' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                        장소 조율(대면)
                    </button>
                    <button
                        type="button"
                        disabled={!hasBehaviorObservation}
                        onClick={() => {
                            if (hasBehaviorObservation) setBookingType('찾아가는(대면)');
                        }}
                        className={`p-3 rounded-xl border text-center transition-all ${
                            !hasBehaviorObservation
                                ? 'border-slate-100 bg-slate-100 text-slate-300 cursor-not-allowed'
                                : bookingType === '찾아가는(대면)'
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                    >
                        찾아가는(대면)
                    </button>
                    <button 
                        type="button" 
                        disabled={hasBehaviorObservation}
                        onClick={() => { if (!hasBehaviorObservation) setBookingType('Zoom(비대면)'); }}
                        className={`p-3 rounded-xl border text-center transition-all ${hasBehaviorObservation ? 'border-slate-100 bg-slate-100 text-slate-300 cursor-not-allowed' : bookingType === 'Zoom(비대면)' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                        화상(비대면)
                    </button>
                    <button 
                        type="button" 
                        disabled={hasBehaviorObservation}
                        onClick={() => { if (!hasBehaviorObservation) setBookingType('AI(비대면)'); }}
                        className={`p-3 rounded-xl border text-center transition-all ${hasBehaviorObservation ? 'border-slate-100 bg-slate-100 text-slate-300 cursor-not-allowed' : bookingType === 'AI(비대면)' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                        AI(비대면)
                    </button>
                </div>
                {/* [MOD-20260712-PARENT-BOOKING-012]
                    행동관찰을 선택해 찾아가는(대면)이 자동 선택된 경우에는
                    중복되는 상담방식 설명 박스를 표시하지 않습니다. */}
                {!(hasBehaviorObservation && bookingType === '찾아가는(대면)') && (() => {
                    const guide = getBookingMethodGuide(bookingType);
                    return (
                        <div className={`mt-3 rounded-2xl border p-4 leading-relaxed ${
                            bookingType === 'AI(비대면)'
                                ? 'border-violet-100 bg-violet-50 text-violet-800'
                                : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}>
                            <p className="text-xs font-extrabold mb-1">{guide.title}</p>
                            <p className="text-xs">{guide.text}</p>
                        </div>
                    );
                })()}
            </div>

            {/* 결제 예정 금액 */}
<div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
    <p className="text-xs font-bold text-slate-700 mb-3">
        결제 예정 금액
    </p>

    {(() => {
        const payment = getPaymentInfo({
            program: bookingProgram,
            type: bookingType,
            extraTests: selectedTests
        });

        return (
            <>
                <p className="text-sm text-slate-600">
                    {payment.detail}
                </p>

                {bookingProgram.includes("부모-자녀") && (
                    <p className="text-[11px] text-emerald-700 mt-2 leading-relaxed font-semibold">
                        기본검사 포함
                    </p>
                )}

                <p className="text-2xl font-extrabold text-emerald-700 mt-3">
                    {payment.total}
                </p>
               
            </>
        );
    })()}
</div>

            {/* 4. 개인 정보 입력 (성함) */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">성함</label>
                <input 
                    type="text" 
                    required
                    value={bookingName}
                    onChange={(e) => setBookingName(e.target.value)}
                    placeholder="성함을 입력하세요"
                    className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
            </div>

            {/* 5. 개인 정보 입력 (연락처) */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">연락처</label>
                <input 
                    type="tel" 
                    required
                    value={bookingPhone}
                    onChange={(e) => setBookingPhone(e.target.value)}
                    placeholder="예) 010-1234-5678"
                    className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
            </div>

            {/* 6. 희망 일정 선택 */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">희망 날짜</label>
                    <input 
                        type="date" 
                        required
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">희망 시간</label>
                    <select
                        required
                        value={bookingTime}
                        onChange={(e) => setBookingTime(e.target.value)}
                        className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    >
                        <option value="">시간 선택</option>
                        {/* [MOD-20260714-BOOKING-OPERATING-SETTINGS] 관리자 설정 기반 시간목록 */}
                        {bookingTimeOptions.map((value) => (
                            <option key={value} value={value}>{value}</option>
                        ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-400">예약 가능 시간은 {bookingOperatingSettings.openTime}부터 {bookingOperatingSettings.closeTime}까지이며, {bookingOperatingSettings.intervalMinutes}분 단위로 선택해 주세요.</p>
                </div>
            </div>

            {/* 7. 상담신청서 · 동의서 입력 */}
            <div style={{display:'none'}} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4" id="bookingApplicationForm">
                <div>
                    <p className="text-sm font-extrabold text-slate-900">상담신청서</p>
                    <p className="text-[11px] text-slate-500 mt-1">상담 준비를 위해 필요한 최소 정보를 함께 작성합니다. 대면상담·비대면 화상상담은 예약일 3일 전 상담신청서와 심리상담 동의서 안내가 함께 발송됩니다.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <a href="./public/forms/application.pdf" target="_blank" className="text-[11px] font-bold px-3 py-2 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">상담신청서 PDF</a>
                        <a href="./public/forms/consent.pdf" target="_blank" className="text-[11px] font-bold px-3 py-2 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200">심리상담 동의서 PDF</a>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">생년월일</label>
                        <input type="date" value={bookingBirth} onChange={(e) => setBookingBirth(e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">이메일</label>
                        <input type="email" value={bookingEmail} onChange={(e) => setBookingEmail(e.target.value)} placeholder="결과 안내용 이메일" className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">선호 연락 방법</label>
                        <select value={bookingContactMethod} onChange={(e) => setBookingContactMethod(e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm">
                            {['전화','문자','이메일','카카오','기타'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">소속/직업군</label>
                        <select value={bookingClientType} onChange={(e) => setBookingClientType(e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm">
                            {['청소년','대학생·대학원생','직장인·일반인','교사','임신·출산','양육자·보호자','기타'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>

                <textarea rows="3" value={bookingConcern} onChange={(e) => setBookingConcern(e.target.value)} placeholder="현재 가장 힘든 점이나 상담/검사를 통해 알고 싶은 점을 적어주세요." className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm resize-none"></textarea>
                <textarea rows="2" value={bookingCounselingHistory} onChange={(e) => setBookingCounselingHistory(e.target.value)} placeholder="이전 상담/치료/검사 경험이 있다면 적어주세요." className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm resize-none"></textarea>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <textarea rows="2" value={bookingMedication} onChange={(e) => setBookingMedication(e.target.value)} placeholder="복용 중인 약" className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm resize-none"></textarea>
                    <textarea rows="2" value={bookingDiagnosis} onChange={(e) => setBookingDiagnosis(e.target.value)} placeholder="진단/치료 중인 질환" className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm resize-none"></textarea>
                    <textarea rows="2" value={bookingRisk} onChange={(e) => setBookingRisk(e.target.value)} placeholder="최근 자해/자살 위험 여부" className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm resize-none"></textarea>
                </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3" id="bookingConsentBox">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-extrabold text-slate-900">예약 필수 동의</p>
                        <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                            각 항목의 내용을 확인하면 자동으로 동의 체크가 완료됩니다. 심리검사와 상담 서비스 특성상 충분한 안내 확인 후 예약을 진행합니다.
                        </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-black rounded-full px-3 py-1 ${bookingAllConsentChecked ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-200'}`}>
                        {bookingAllConsentChecked ? '동의 완료' : '확인 필요'}
                    </span>
                </div>

                {[
                    { key: 'privacy', checked: bookingPrivacyConsent, label: '개인정보 수집·이용 동의' },
                    { key: 'service', checked: bookingServiceConsent, label: '심리검사 및 상담 서비스 이용 동의' },
                    { key: 'confidentiality', checked: bookingCounselingConsent, label: '비밀보장 및 상담윤리 안내' },
                    { key: 'cancel', checked: bookingCancelConsent, label: '예약 변경·취소 및 노쇼 규정' }
                ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 bg-white border border-emerald-100 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <input type="checkbox" checked={item.checked} readOnly className="mt-0.5" />
                            <span className="text-xs font-semibold text-slate-700 truncate">{item.label}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setBookingConsentModal(item.key)}
                            className="shrink-0 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 hover:bg-emerald-100"
                        >
                            내용보기
                        </button>
                    </div>
                ))}

                <input value={bookingSignature} onChange={(e) => setBookingSignature(e.target.value)} placeholder="전자서명: 신청인 성함을 입력해 주세요" className="w-full bg-white border border-emerald-200 px-4 py-3 rounded-xl text-sm" />
            </div>

            {/* 7. 최종 제출 버튼 */}
            <button 
                type="submit"
                disabled={!bookingAllConsentChecked || !bookingSignature.trim()}
                className={`w-full py-4 mt-2 rounded-xl text-white font-bold transition-all shadow-md shadow-slate-900/10 text-sm ${bookingAllConsentChecked && bookingSignature.trim() ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-300 cursor-not-allowed'}`}
            >
                예약 필수 동의 후 신청하기
            </button>
        </form> 
    </div>

              </div>
         </div>
     </section>
{bookingConsentModal && bookingConsentContents[bookingConsentModal] && (
                          <div className="fixed inset-0 z-[10003] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
                              <div className="absolute inset-0" onClick={() => setBookingConsentModal(null)}></div>
                              <div className="relative bg-white rounded-[2rem] w-full max-w-2xl max-h-[88vh] overflow-auto shadow-2xl border border-slate-100 p-6 sm:p-8 fade-in">
                                  <div className="flex items-start justify-between gap-4 mb-6">
                                      <div>
                                          <span className="inline-block text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-3 py-1 mb-3">
                                              {bookingConsentContents[bookingConsentModal].badge}
                                          </span>
                                          <h3 className="text-2xl font-extrabold text-slate-900">
                                              {bookingConsentContents[bookingConsentModal].title}
                                          </h3>
                                          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                              아래 내용을 확인한 뒤 확인 버튼을 누르면 해당 항목이 동의 처리됩니다.
                                          </p>
                                      </div>
                                      <button type="button" onClick={() => setBookingConsentModal(null)} className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 font-bold hover:bg-slate-200">
                                          ×
                                      </button>
                                  </div>

                                  <div className="space-y-4">
                                      {bookingConsentContents[bookingConsentModal].body.map((section, idx) => (
                                          <div key={idx} className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
                                              <h4 className="text-sm font-extrabold text-slate-900 mb-3">{section.heading}</h4>
                                              <ul className="space-y-2 text-sm text-slate-600 leading-relaxed">
                                                  {section.lines.map((line, lineIdx) => (
                                                      <li key={lineIdx} className="flex items-start gap-2">
                                                          <span className="text-emerald-600 font-black mt-0.5">•</span>
                                                          <span>{line}</span>
                                                      </li>
                                                  ))}
                                              </ul>
                                          </div>
                                      ))}
                                  </div>

                                  <div className="mt-6 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                                      <p className="text-xs text-amber-900 leading-relaxed">
                                          ※ 본 안내는 예약 전 확인용이며, 세부 운영정책은 예약 확정 안내와 실제 상담·검사 진행 상황에 따라 추가 안내될 수 있습니다.
                                      </p>
                                  </div>

                                  <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <button type="button" onClick={() => setBookingConsentModal(null)} className="rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
                                          닫기
                                      </button>
                                      <button type="button" onClick={confirmBookingConsent} className="rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white hover:bg-slate-800">
                                          내용을 확인했습니다
                                      </button>
                                  </div>
                              </div>
                          </div>
                      )}

                      {isAiIntakeOpen && (
                          <div className="fixed inset-0 z-[10002] bg-slate-950/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
                              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] w-full max-w-5xl max-h-none sm:max-h-[92vh] overflow-visible sm:overflow-hidden shadow-2xl border border-slate-100 flex flex-col my-2 sm:my-0">
                                  <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
                                      <div>
                                          <p className="text-xs font-bold text-amber-700 mb-1">MODUMAM LAB AI INTAKE</p>
                                          <h2 className="text-2xl font-extrabold text-slate-900">AI 마음지기와 마음 대화</h2>
                                          <p className="text-sm text-slate-500 mt-1">대화 내용은 상담 준비를 위해 관리자에게만 저장됩니다.</p>
                                      </div>
                                      <button
                                          type="button"
                                          onClick={closeAiIntakeChat}
                                          className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold"
                                      >
                                          ×
                                      </button>
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 flex-1 overflow-y-auto lg:overflow-hidden">
                                      <div className="lg:col-span-1 bg-slate-50 border-r border-slate-100 p-5 overflow-visible lg:overflow-auto">
                                          <h3 className="text-sm font-extrabold text-slate-900 mb-3">AI 마음체크 이용 동의</h3>
                                          
                                          <label className="flex items-start gap-3 bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer">
    <input
        type="checkbox"
        checked={aiIntakeUser.privacyAgree}
        onChange={(e) =>
            setAiIntakeUser({
                privacyAgree: e.target.checked
            })
        }
    />

    <span className="text-xs text-slate-600 leading-relaxed">
        개인정보 수집 및 AI 마음체크 대화 저장에 동의합니다.<br/>
        AI 마음체크는 진단이 아니며, 현재 마음을 이해하기 위한 참고자료입니다.
    </span>
</label>

                                          <div className="mt-5 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                                              <p className="text-xs font-bold text-amber-800 mb-2">안전 안내</p>
                                              <p className="text-xs text-slate-600 leading-relaxed">
                                                  자해나 자살 위험이 크거나 즉각적인 도움이 필요하다면 112, 119, 자살예방상담전화 109 또는 가까운 응급실에 즉시 도움을 요청해 주세요.
                                              </p>
                                          </div>
                                      </div>

                                      <div className="lg:col-span-2 flex flex-col min-h-[60vh] sm:max-h-[72vh]">
                                          {!aiIntakeReport ? (
                                              <>
                                                  <div ref={chatBodyRef} id="ai-chat-body" className="flex-1 overflow-auto p-5 sm:p-6 space-y-4 bg-white">
                                                      {aiIntakeMessages.map((message, index) => (
                                                          <div
                                                              key={index}
                                                              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                                          >
                                                              <div className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"} max-w-[82%]`}>
                                                                  <div
                                                                      className={`rounded-3xl px-5 py-4 text-sm leading-relaxed whitespace-pre-line ${
                                                                          message.role === "user"
                                                                              ? "bg-slate-900 text-white"
                                                                              : "bg-amber-50 text-slate-700 border border-amber-100"
                                                                      }`}
                                                                  >
                                                                      {message.text}
                                                                  </div>
                                                                  <span className="text-[11px] text-slate-400 mt-1 px-2">{message.time || ""}</span>
                                                              </div>
                                                          </div>
                                                      ))}
                                                      {isAiIntakeThinking && (
                                                          <div className="flex justify-start">
                                                              <div className="max-w-[82%] rounded-3xl px-5 py-4 text-sm leading-relaxed bg-amber-50 text-slate-500 border border-amber-100">
                                                                  마음지기가 잠시 이야기를 정리하고 있습니다…
                                                              </div>
                                                          </div>
                                                      )}
                                                  </div>

                                                  <div className="p-4 border-t border-slate-100 bg-white">
                                                      <div className="flex gap-2">
                                                          <textarea
                                                              ref={chatInputRef}
                                                              id="ai-chat-input"
                                                              value={aiIntakeInput}
                                                              onChange={(e) => setAiIntakeInput(e.target.value)}
                                                              disabled={aiIntakeSessionPhase === "ended"}
                                                              onKeyDown={(e) => {
                                                                  if (e.key === "Enter" && !e.shiftKey) {
                                                                      e.preventDefault();
                                                                      handleAiIntakeSend();
                                                                  }
                                                              }}
                                                              rows="2"
                                                              placeholder={aiIntakeSessionPhase === "awaiting-report" ? "리포트 확인: Y 입력" : aiIntakeSessionPhase === "ended" ? "AI 마음체크가 종료되었습니다" : "Enter 전송 · Shift+Enter 줄바꿈"}
                                                              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm resize-none disabled:bg-slate-100 disabled:text-slate-400"
                                                          ></textarea>
                                                          <button
                                                              type="button"
                                                              onClick={handleAiIntakeSend}
                                                              disabled={isAiIntakeThinking || aiIntakeSessionPhase === "ended"}
                                                              className={`rounded-2xl px-5 text-sm font-extrabold ${(isAiIntakeThinking || aiIntakeSessionPhase === "ended") ? "bg-slate-300 text-white cursor-not-allowed" : "bg-slate-900 text-white"}`}
                                                          >
                                                              {isAiIntakeThinking ? "정리 중" : aiIntakeSessionPhase === "awaiting-report" ? "확인" : aiIntakeSessionPhase === "ended" ? "종료" : "전송"}
                                                          </button>
                                                      </div>
                                                      <p className="text-[11px] text-slate-400 mt-2">
                                                          AI 마음 상담은 상담 준비용으로 저장됩니다.
                                                      </p>
                                                  </div>
                                              </>
                                          ) : (
                                              <div className="overflow-auto p-5 sm:p-6 bg-slate-50">
                                                  <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                                                      <p className="text-xs font-bold text-emerald-700 mb-2">모두의 마음연구소</p>
                                                      <h3 className="text-2xl font-extrabold text-slate-900 mb-2">AI 마음체크리포트</h3>
                                                      <p className="text-sm text-slate-500 leading-relaxed mb-5">지금까지 나눈 대화를 바탕으로 현재 마음을 정리했습니다.</p>
                                                      

                                                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-4">
                                                          <h4 className="text-sm font-extrabold text-amber-800 mb-2">마음 한줄</h4>
                                                          <p className="text-base font-bold text-slate-800 leading-relaxed whitespace-pre-line">
                                                              {aiIntakeReport.mindLine || aiIntakeReport.rememberMessage}
                                                          </p>
                                                      </div>

                                                      <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-4">
                                                          <h4 className="text-sm font-extrabold text-slate-900 mb-3">알아차림</h4>
                                                          <p className="text-sm text-slate-700 leading-7 whitespace-pre-line">
                                                              {aiIntakeReport.awareness || aiIntakeReport.empathy}
                                                          </p>
                                                      </div>

                                                      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 mb-4">
                                                          <h4 className="text-sm font-extrabold text-sky-800 mb-3">마음 연결</h4>
                                                          <p className="text-sm text-slate-700 leading-7 whitespace-pre-line">
                                                              {aiIntakeReport.mindConnection || aiIntakeReport.mindReflection}
                                                          </p>
                                                      </div>

                                                      <div style={{display:"none"}} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                              <p className="text-xs font-bold text-slate-500 mb-1">스트레스</p>
                                                              <p className="text-lg font-extrabold text-slate-900">{barText(aiIntakeReport.scores?.stress || 1)}</p>
                                                          </div>
                                                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                              <p className="text-xs font-bold text-slate-500 mb-1">불안</p>
                                                              <p className="text-lg font-extrabold text-slate-900">{barText(aiIntakeReport.scores?.anxiety || 1)}</p>
                                                          </div>
                                                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                              <p className="text-xs font-bold text-slate-500 mb-1">우울/무기력</p>
                                                              <p className="text-lg font-extrabold text-slate-900">{barText(aiIntakeReport.scores?.depression || 1)}</p>
                                                          </div>
                                                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                              <p className="text-xs font-bold text-slate-500 mb-1">회복에너지</p>
                                                              <p className="text-lg font-extrabold text-emerald-700">{barText(aiIntakeReport.scores?.energy || 1)}</p>
                                                          </div>
                                                      </div>

                                                      <div style={{display:"none"}} className="bg-white border border-slate-100 rounded-2xl p-5 mb-4">
                                                          <h4 className="text-sm font-extrabold text-slate-900 mb-2">상담자용 마음정리</h4>
                                                          <pre className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-sans">
                                                              {aiIntakeReport.mindReflection || aiIntakeReport.summary}
                                                          </pre>
                                                      </div>

                                                      <div style={{display:"none"}} className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-4">
                                                          <h4 className="text-sm font-extrabold text-indigo-800 mb-3">AI가 발견한 키워드</h4>
                                                          <div className="flex flex-wrap gap-2">
                                                              {(aiIntakeReport.keywords || []).map((keyword) => (
                                                                  <span key={keyword} className="bg-white border border-indigo-100 text-indigo-700 rounded-full px-4 py-2 text-xs font-bold">
                                                                      {keyword}
                                                                  </span>
                                                              ))}
                                                          </div>
                                                      </div>

                                                      <div style={{display:"none"}} className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-4">
                                                          <h4 className="text-sm font-extrabold text-emerald-800 mb-3">마음의 강점</h4>
                                                          <div className="flex flex-wrap gap-2">
                                                              {(aiIntakeReport.strengths || []).map((strength) => (
                                                                  <span key={strength} className="bg-white border border-emerald-100 text-emerald-700 rounded-full px-4 py-2 text-xs font-bold">
                                                                      {strength}
                                                                  </span>
                                                              ))}
                                                          </div>
                                                      </div>

                                                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-4">
                                                          <h4 className="text-sm font-extrabold text-emerald-800 mb-3">나에게 도움이 될 수 있는 심리검사</h4>
                                                          <div className="flex flex-wrap gap-2">
                                                              {(aiIntakeReport.recommendedTests || []).map((test) => (
                                                                  <div key={test.name || test} className="bg-white border border-emerald-100 rounded-2xl p-4">
                                                                      <p className="text-sm font-extrabold text-emerald-800">{test.name || test}</p>
                                                                      {test.reason && (
                                                                          <p className="text-xs text-slate-600 leading-relaxed mt-2">{test.reason}</p>
                                                                      )}
                                                                  </div>
                                                              ))}
                                                          </div>
                                                          <p className="text-xs text-slate-500 leading-relaxed mt-4">
                                                              심리검사는 오늘 나눈 이야기를 더 깊이 이해하기 위한 선택지입니다. 최종 검사는 전문가 상담에서 함께 조율할 수 있습니다.
                                                          </p>
                                                      </div>


                                                      <div style={{display:"none"}} className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-4">
                                                          <h4 className="text-sm font-extrabold text-amber-800 mb-2">오늘 해볼 수 있는 작은 마음실천</h4>
                                                          <p className="text-sm text-slate-700 leading-relaxed">{aiIntakeReport.smallPractice}</p>
                                                      </div>

                                                      <div className={`${aiIntakeReport.riskLevel === "높음" ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-indigo-50 border-indigo-100 text-indigo-800"} border rounded-2xl p-5 mb-5`}>
                                                          <h4 className="text-sm font-extrabold mb-2">안내</h4>
                                                          <p className="text-sm leading-relaxed">
                                                              {aiIntakeReport.guide}
                                                          </p>
                                                      </div>

                                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                          <button type="button" onClick={copyAiReportForUser} className="bg-white border border-slate-200 text-slate-700 rounded-2xl py-3 text-sm font-bold">
                                                              상담자용 내용 복사
                                                          </button>
                                                          <button type="button" onClick={goToReservationFromAiReport} className="bg-emerald-600 text-white rounded-2xl py-3 text-sm font-extrabold">
                                                              심리검사 예약하기
                                                          </button>
                                                          <button type="button" onClick={closeAiIntakeChat} className="bg-slate-900 text-white rounded-2xl py-3 text-sm font-extrabold">
                                                              확인
                                                          </button>
                                                      </div>

                                                      <p className="text-xs text-slate-400 mt-5 leading-relaxed">
                                                          AI 마음체크리포트는 진단이나 심리평가 결과가 아니며, 대화를 바탕으로 현재 마음을 이해하기 쉽게 정리한 참고자료입니다.
                                                      </p>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}


                      {isAdminLoginOpen && (
    <div className="fixed inset-0 z-[10001] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="absolute inset-0" onClick={() => setIsAdminLoginOpen(false)}></div>
        <form onSubmit={submitAdminLogin} className="relative bg-white rounded-3xl w-full max-w-md p-7 shadow-2xl border border-slate-100">
            <div className="mb-5">
                <p className="text-xs font-bold text-emerald-700 mb-1">MODUMAM LAB ADMIN</p>
                <h2 className="text-2xl font-extrabold text-slate-900">관리자 로그인</h2>
                <p className="text-sm text-slate-500 mt-2">비밀번호 입력 후 관리자 페이지로 이동합니다.</p>
            </div>

            <input
                type="password"
                autoFocus
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="관리자 비밀번호"
                className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />

            {adminLoginError && (
                <p className="mt-3 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">
                    {adminLoginError}
                </p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-5">
                <button
                    type="button"
                    onClick={() => setIsAdminLoginOpen(false)}
                    className="rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                    취소
                </button>
                <button
                    type="submit"
                    className="rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white hover:bg-slate-800"
                >
                    로그인
                </button>
            </div>
        </form>
    </div>
)}


                      {isAdminPageOpen && isAdmin && (
    <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-7xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 p-5 sm:p-6 flex justify-between items-center z-10">
                <div>
                    <p className="text-xs font-bold text-emerald-700 mb-1">MODUMAM LAB ADMIN</p>
                    <h2 className="text-2xl font-extrabold text-slate-900">관리자 페이지</h2>
                </div>
                <button
                    type="button"
                    onClick={() => setIsAdminPageOpen(false)}
                    className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold"
                >
                    ×
                </button>
            </div>

            <div className="p-5 sm:p-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="bg-slate-50 rounded-3xl border border-slate-100 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-extrabold text-slate-900">예약 현황 수정</h3>
                        <span className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1 rounded-full">{reservations.length}건</span>
                    </div>

                    <div className="space-y-4">
                        {reservations.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-400 border border-dashed border-slate-200">
                                예약 신청 내역이 없습니다.
                            </div>
                        ) : reservations.map((res) => (
                            <div key={res.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div>
                                        <p className="font-extrabold text-slate-900">{res.name}님</p>
                                        <p className="text-xs text-slate-500 mt-1">{res.phone}</p>
                                        <p className="text-sm font-bold text-slate-700 mt-2">{
                                            String(res.program || '').includes('부모-자녀')
                                                ? '부모-자녀 마음이음'
                                                : String(res.program || '').includes('부부')
                                                    ? '부부 마음이음'
                                                    : '개인 마음이음'
                                        }</p>
                                        <p className="text-xs text-slate-500 mt-1">{res.type} · {res.date} {res.time}</p>
                                        <p className="text-xs text-emerald-700 font-bold mt-2">{getPaymentInfo(res).total} / {getPaymentInfo(res).detail}</p>
                                    </div>
                                    <span className={`text-[11px] px-3 py-1 rounded-full font-bold ${getStatusStyle(res.status)}`}>
                                        {res.status || "승인대기"}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                                    {['승인대기', '예약확정', '검사진행', '상담완료', '예약취소'].map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => updateReservationStatus(res.id, status)}
                                            className="text-xs font-bold border border-slate-200 rounded-xl px-2 py-2 hover:bg-slate-50"
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 xl:col-span-2">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-extrabold text-slate-900">심리검사 기본 구성</h3>
                        <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">PAT · KCDI 반영</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <p className="font-extrabold text-slate-900 mb-2">개인 마음이음</p>
                            <p className="text-slate-600">기본: TCI</p>
                            <p className="text-xs text-slate-400 mt-1">추가: MMPI-2, SCT, HTP 등</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                            <p className="font-extrabold text-emerald-900 mb-2">부모-자녀 마음이음</p>
                            <p className="text-emerald-800 font-bold">기본: PAT + KCDI</p>
                            <p className="text-xs text-emerald-700 mt-1">부모 양육태도와 자녀 발달을 통합 확인</p>
                        </div>
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                            <p className="font-extrabold text-blue-900 mb-2">부부 마음이음</p>
                            <p className="text-blue-800">기본: TCI × 2</p>
                            <p className="text-xs text-blue-700 mt-1">추가: SCT, HTP 등</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 text-white">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-extrabold">AI 상담자가 이해한 마음정리</h3>
                        <span className="text-xs font-bold bg-white/10 text-emerald-200 px-3 py-1 rounded-full">{intakeSummaries.length}건</span>
                    </div>

                    <div className="space-y-4">
                        {intakeSummaries.length === 0 ? (
                            <div className="bg-white/10 rounded-2xl p-8 text-center text-sm text-slate-300 border border-white/10">
                                아직 저장된 상담자가 이해한 마음정리가 없습니다.
                            </div>
                        ) : intakeSummaries.map((item) => (
                            <div key={item.id} className="bg-white text-slate-800 rounded-2xl p-5 border border-slate-100 shadow-sm">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <p className="font-extrabold text-slate-900">{item.name}</p>
                                        <p className="text-xs text-slate-500 mt-1">{item.phone} · {item.email}</p>
                                        <p className="text-xs text-slate-400 mt-1">{item.date}</p>
                                    </div>
                                    <span className="text-[11px] font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-full">
                                        {item.status}
                                    </span>
                                </div>
                                {item.risk && (
                                    <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3 mb-3">
                                        위기 신호: {item.risk}
                                    </p>
                                )}
                                <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-slate-50 border border-slate-100 rounded-2xl p-4 max-h-72 overflow-y-auto">
                                    {item.mindReflection || item.summary}
                                </pre>
                                <div className="flex justify-end gap-2 mt-3">
                                    <button
                                        type="button"
                                        onClick={() => navigator.clipboard.writeText(item.summary)}
                                        className="text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50"
                                    >
                                        요약 복사
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
)}


{isAuthModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div
            className="absolute inset-0"
            onClick={() => setIsAuthModalOpen(false)}
        ></div>

        <div className="relative bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-100 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-extrabold text-slate-900">
                    {/* v28 수정: AI 마음체크 이용 흐름이 드러나도록 회원가입/로그인 팝업 제목 정리 */}
                    {authMode === 'signup' ? 'AI 마음체크 회원가입' : 'AI 마음체크 로그인'}
                </h3>

                <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
                >
                    ✕
                </button>
            </div>

            {/* v28 수정: AI 마음체크 이용 시 회원가입 또는 로그인이 필요하다는 안내를 팝업 안에서 먼저 보여줍니다. */}
            <div className="mb-5 text-sm text-slate-600 leading-relaxed bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="font-semibold text-indigo-700 mb-2">AI 마음체크 이용 안내</p>
                <p>
                    AI 마음체크는 AI 마음지기와 채팅형 대화를 통해 현재의 마음을 더 깊이 이해하는 공간입니다.
                    이용을 위해 회원가입 또는 로그인을 진행해 주세요.
                </p>
            </div>

            {authMode === 'signup' && (
                <div className="mb-5 text-sm text-slate-600 leading-relaxed bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <p className="font-semibold text-emerald-700 mb-2">
                        AI 마음체크 안내
                    </p>

                    <p>
                        AI 마음체크는 현재의 마음을 보다 깊이 이해하고,
                        필요한 심리검사와 상담 준비를 위한 과정입니다.
                    </p>

                    <p className="mt-2">
                        AI는 현재의 마음을 이해하고 정리하는 보조도구이며,
                        최종 심리검사 해석과 상담은
                        <strong> 국가기술자격 임상심리사 1급</strong>이 진행합니다.
                    </p>
                </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
                {/* [MOD-20260713-RESULT-LOGIN-FIELDS-FIX]
                    검사결과는 이름·연락처로 연결되므로 회원가입과 로그인 모두 입력받습니다. */}
                <>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">이름</label>
                        <input
                            type="text"
                            required
                            placeholder="예약 시 입력한 이름"
                            value={authForm.name}
                            onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-900 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">전화번호</label>
                        <input
                            type="tel"
                            required
                            placeholder="예약 시 입력한 연락처"
                            value={authForm.phone}
                            onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-900 transition-colors"
                        />
                    </div>
                </>

                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">이메일 주소</label>
                    <input
                        type="email"
                        required
                        placeholder="example@email.com"
                        value={authForm.email}
                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-900 transition-colors"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">비밀번호</label>
                    <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={authForm.password}
                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-900 transition-colors"
                    />
                </div>

                {authMode === 'signup' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed">
                        <p className="font-bold text-slate-800 mb-2">
                            개인정보 수집·이용 및 AI 서비스 이용 안내
                        </p>

                        <p>
                            수집 항목: 이름, 연락처, 이메일, AI 마음상담 내용
                        </p>

                        <p className="mt-2">
                            이용 목적: AI 마음이해, AI 마음상담, 심리검사 추천,
                            심리검사 예약 및 상담 서비스 제공
                        </p>

                        <p className="mt-2">
                            AI 마음 상담은 마음이해를 위한 보조 서비스이며,
                            의학적 진단이나 심리검사의 최종 해석을 대신하지 않습니다.
                        </p>

                        <p className="mt-2">
                            회원님의 개인정보와 상담 내용은 관련 법령에 따라 안전하게 보호됩니다.
                        </p>

                        <label className="flex items-start gap-2 mt-3 text-slate-700">
                            <input
                                type="checkbox"
                                required
                                className="mt-0.5"
                            />
                            <span>
                                위 내용을 확인하였으며, 개인정보 수집·이용 및 AI 서비스 이용에 동의합니다.
                            </span>
                        </label>
                    </div>
                )}

                <button
                    type="submit"
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-colors shadow-lg mt-2"
                >
                    {authMode === 'signup' ? '회원가입하고 AI 마음 상담 시작하기' : '로그인'}
                </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                    {authMode === 'signup' ? '이미 계정이 있으신가요?' : '아직 회원이 아니신가요?'}

                    <button
                        type="button"
                        onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                        className="text-indigo-600 font-bold ml-1.5 hover:underline"
                    >
                        {authMode === 'signup' ? '로그인하기' : '회원가입하기'}
                    </button>
                </p>
            </div>
        </div>
    </div>
)}
     </main>

                    
                    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-16 px-4 sm:px-6 lg:px-8 text-xs sm:text-sm">
                      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-14 lg:gap-16">
  <div className="md:col-span-6 space-y-4">
    <div className="flex items-center space-x-2">
      <div className="flex space-x-0.5 bg-slate-800 p-1.5 rounded-lg">
        <span className="font-extrabold text-mind-question text-xs font-mono">?</span>
        <span className="font-extrabold text-mind-exclamation text-xs font-mono">!</span>
        <span className="font-extrabold text-mind-comma text-xs font-mono">,</span>
        <span className="font-extrabold text-mind-period text-xs font-mono">.</span>
      </div>
      <span className="font-extrabold text-white text-base tracking-tight">
        모두의 마음연구소
      </span>
    </div>

    <p className="leading-relaxed text-slate-400 max-w-lg text-xs">
      마음의 문장부호를 통해 지금 내 마음의 상태를 알아차리고,
      심리검사로 조금 더 정확하게 이해하며,
      상담을 통해 회복과 변화로 함께 나아갑니다.
      <br /><br />
      물음표(?)에 머물러 있는 이들에게는 <strong className="text-slate-200">다정한 질문을</strong>을,<br />
      느낌표(!)에 흔들리는 이들에게는 <strong className="text-slate-200">감정의 수용을</strong>을,<br />
      쉼표(,)가 필요한 이들에게는 <strong className="text-slate-200">온전한 쉼과 자기 돌봄</strong>을,<br />
      마침표(.) 앞에 선 이들에게는 <strong className="text-slate-200">다시 시작할 용기</strong>를 함께하겠습니다.
      <br /><br />
      <span className="text-white font-semibold">
        모두의 마음연구소는 
        마음을 진단하는 곳이 아니라,
        마음을 이해하고 연결하는 곳입니다.
      </span>
    </p>
  </div>

  <div className="md:col-span-3">
    <h5 className="font-bold text-white mb-4">제공 심리검사</h5>

<div className="space-y-4 text-xs">

  <div>
    <p className="font-semibold text-slate-200 mb-1">기질 · 성격</p>
    <p>(J)TCI · STS · GOLDEN</p>
  </div>

  <div>
    <p className="font-semibold text-slate-200 mb-1">정신건강</p>
    <p>MMPI-2(A) · PAI · RS</p>
  </div>

  <div>
    <p className="font-semibold text-slate-200 mb-1">관계 · 양육</p>
    <p>K-IIP · PAT · KCDI</p>
  </div>

  <div>
    <p className="font-semibold text-slate-200 mb-1">투사 · 진로</p>
    <p>SCT · HTP · CAD · Holland</p>
  </div>

</div>
</div>
 <div className="md:col-span-3">
  <h5 className="font-bold text-white mb-4">
    심리검사 예약 · 상담 채널
  </h5>

  <ul className="space-y-5 text-[11px] text-slate-400">

    <li>
      <strong className="block text-slate-200 mb-1">
        온라인 마음 링크 서비스 (비대면)
      </strong>
      Zoom · 화상 · 전화 상담<br />
      상담 2만 원 / 기본검사 3만 원 / 추가검사 3만 원
    </li>

    <li>
      <strong className="block text-slate-200 mb-1">
        찾아가는 프리미엄 서비스 (대면)
      </strong>
      장소 조율 · 방문 상담<br />
      상담 5만 원 / 기본검사 3만 원 / 추가검사 3만 원<br />
      ※ 천안·아산 외 지역은 별도 문의
    </li>

    </ul>
  </div>
</div>
                       <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">

  <div className="text-center sm:text-left space-y-1">
    <p>© 2026 모두의 마음연구소. All rights reserved.</p>

    <p className="text-slate-500">
      사업자등록번호 : 268-12-03173
    </p>

    <div className="flex justify-center sm:justify-start gap-2 text-slate-400">
      <a
        href="https://blog.naver.com/in0-100/224315714398"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-white"
      >
        이용약관
      </a>

      <span>|</span>

      <a
        href="https://blog.naver.com/in0-100/224322556073"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-white"
      >
        개인정보처리방침
      </a>
    </div>
  </div>

   <p className="text-slate-500 text-center sm:text-right max-w-2xl leading-relaxed">
  본 AI 상담 도구는 자발적 자기이해를 돕는 참고용입니다.
  <br />
  중대한 정신건강 위기나 의학적 진단이 필요한 경우에는 전문 의료기관의 도움을 권합니다.
</p>

</div>
                    </footer>

             {/* Recommended Test Description Popup */}
             {selectedTestPopup && (
                 <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
                     <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative">
                         <button
                             type="button"
                             onClick={() => setSelectedTestPopup(null)}
                             className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
                             aria-label="닫기"
                         >
                             <i data-lucide="x" className="w-5 h-5"></i>
                         </button>
                         <p className="text-xs font-extrabold text-indigo-600 mb-2">추천 검사 설명</p>
                         <h3 className="text-2xl font-extrabold text-slate-900 mb-2 pr-8">
                             {selectedTestPopup.title}
                         </h3>
                         <p className="text-sm font-bold text-slate-600 mb-4">
                             {selectedTestPopup.subtitle}
                         </p>
                         <div className="space-y-3">
                             <div className="bg-slate-50 rounded-2xl p-4">
                                 <p className="text-xs font-extrabold text-slate-500 mb-1">무엇을 알 수 있나요?</p>
                                 <p className="text-sm text-slate-700 leading-relaxed">
                                     {selectedTestPopup.desc}
                                 </p>
                             </div>
                             <div className="bg-indigo-50 rounded-2xl p-4">
                                 <p className="text-xs font-extrabold text-indigo-600 mb-1">상담에서는 어떻게 활용되나요?</p>
                                 <p className="text-sm text-slate-700 leading-relaxed">
                                     {selectedTestPopup.use}
                                 </p>
                             </div>
                         </div>
                         <button
                             type="button"
                             onClick={() => setSelectedTestPopup(null)}
                             className="mt-5 w-full bg-slate-900 text-white rounded-2xl py-3 text-sm font-extrabold hover:bg-slate-800"
                         >
                             확인했습니다
                         </button>
                     </div>
                 </div>
             )}

             {/* Report Popup */}
             {showReport && (
                 <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl w-full max-w-6xl h-[90vh] overflow-auto relative">

                         <button
                             onClick={() => setShowReport(false)}
                             className="absolute top-5 right-5 bg-red-500 text-white w-10 h-10 rounded-full text-xl z-10"
                         >
                             ×
                         </button>

                         <div className="p-10">
                             {/*<h2 className="text-3xl font-extrabold text-slate-900 mb-4">
                                 {selectedReport} 검사 결과 보고서
                             </h2>*/}

{selectedReport === "TCI" && (
    <div id="print-report" className="space-y-6">

        {/* Header */}
        <div className="border-b-2 border-emerald-900 pb-5">
            <p className="text-xs font-bold text-emerald-700 mb-2">
                MODUMAM LAB PSYCHOLOGICAL REPORT
            </p>
            <h3 className="text-3xl font-extrabold text-slate-900">
                TCI · SCT 통합 심리검사 해석 보고서
            </h3>
            <p className="text-sm text-slate-500 mt-3">
                기질과 성격, 무의식적 사고 흐름을 함께 살펴보는 통합 해석 예시입니다.
            </p>
        </div>

        {/* Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <div>
                <p className="text-xs text-slate-400 mb-1">고객 성명</p>
                <p className="font-bold text-slate-900">{memberName || "홍길동"}</p>
            </div>
            <div>
                <p className="text-xs text-slate-400 mb-1">검사일자</p>
                <p className="font-bold text-slate-900">2026. 06. 29</p>
            </div>
            <div>
                <p className="text-xs text-slate-400 mb-1">담당 상담사</p>
                <p className="font-bold text-slate-900">이마음 전문상담사</p>
            </div>
            <div>
                <p className="text-xs text-orange-500 mb-1">임상적 방어기제</p>
                <p className="font-bold text-orange-600">주지화 및 수동공격</p>
            </div>
        </div>

        {/* Summary */}
        <div className="border-l-4 border-orange-400 pl-5 py-2">
            <p className="text-xs font-extrabold text-orange-500 mb-2">
                OVERALL SUMMARY
            </p>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
                “높은 위험회피 기질로 인해 환경에 민감하게 반응하는 편이나,
                문장완성검사에서 나타난 내밀한 자기 성찰 욕구와 표현 갈망을 통해
                삶에 대한 성숙한 정서전환 또한 엿볼 수 있습니다.”
            </p>
        </div>

        {/* TCI Profile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-extrabold text-slate-900">
                        TCI 기질
                    </h4>
                    <span className="text-xs font-bold bg-emerald-600 text-white px-3 py-1 rounded-full">
                        생물학적 성향
                    </span>
                </div>

                {[
                    ["자극추구 NS", 70],
                    ["위험회피 HA", 90],
                    ["사회적민감성 RD", 50],
                    ["인내력 P", 30]
                ].map(([label, value]) => (
                    <div key={label} className="mb-4">
                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                            <span>{label}</span>
                            <span>{value}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${value}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-extrabold text-slate-900">
                        TCI 성격
                    </h4>
                    <span className="text-xs font-bold bg-orange-400 text-white px-3 py-1 rounded-full">
                        환경적 적응
                    </span>
                </div>

                {[
                    ["자율성 SD", 50],
                    ["연대감 CO", 80],
                    ["자기초월 ST", 40]
                ].map(([label, value]) => (
                    <div key={label} className="mb-4">
                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                            <span>{label}</span>
                            <span>{value}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${value}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* SCT */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5">
                <h4 className="font-extrabold text-emerald-900">
                    SCT 무의식 및 영역별 주요 반응 분석
                </h4>
                <p className="text-xs text-slate-500 mt-2 sm:mt-0">
                    불안/스트레스: <strong className="text-orange-500">80%</strong>
                    <span className="mx-2">|</span>
                    자아강도: <strong className="text-emerald-600">30%</strong>
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    {
                        title: "1. 자아 및 일반 감정",
                        quote: "내 생각에 가족은…",
                        text: "내가 명명 무가치한 존재가 될까 봐 두렵다",
                        note: "자신의 가치가 외부 성취에 종속되어 있어, 실패와 좌절에 쉽게 흔들릴 가능성이 있습니다."
                    },
                    {
                        title: "2. 대인 및 사회관계",
                        quote: "내가 가장 힘든 것은…",
                        text: "남들에게 미움받을 수 없어 거절하지 못해",
                        note: "높은 사회적 민감성과 거절 회피가 맞물려, 관계 갈등을 피하려다 오히려 부담이 커질 수 있습니다."
                    },
                    {
                        title: "3. 자기 평가와 적응",
                        quote: "나의 어머니는…",
                        text: "언제나 더 잘하길 바라셨고, 나는 부족하다",
                        note: "양육자와의 관계 경험이 현재의 자기기준과 완벽주의에 영향을 줄 수 있습니다."
                    }
                ].map((item) => (
                    <div key={item.title} className="bg-white rounded-2xl p-5 border border-emerald-200">
                        <p className="text-xs font-extrabold text-emerald-700 mb-3">
                            {item.title}
                        </p>
                        <p className="text-xs text-slate-400 mb-1">
                            {item.quote}
                        </p>
                        <p className="text-sm font-bold text-slate-800 mb-3">
                            {item.text}
                        </p>
                        <p className="text-xs text-orange-500 font-bold mb-1">
                            임상 해석
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            {item.note}
                        </p>
                    </div>
                ))}
            </div>
        </div>

        {/* Clinical Opinion */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h4 className="text-lg font-extrabold text-slate-900 mb-4">
                TCI와 SCT의 다차원적 통합 임상 소견
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
                위험회피 성향이 높고 사회적 민감성이 함께 나타나, 새로운 환경이나 대인관계 상황에서
                긴장과 예측 불안을 크게 경험할 수 있습니다. SCT에서는 타인의 평가와 거절에 대한 민감성이
                반복적으로 나타나며, 이는 현재의 관계 피로와 자기비난으로 이어질 가능성이 있습니다.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mt-3">
                다만 연대감이 비교적 높게 나타나 관계 안에서 책임감과 배려를 발휘할 수 있는 자원이 확인됩니다.
                상담에서는 자기비난을 줄이고, 자신의 신중함을 ‘약점’이 아닌 ‘안전을 살피는 능력’으로
                재해석하는 과정이 도움이 될 수 있습니다.
            </p>
        </div>

        {/* Action Plan */}
        <div>
            <h4 className="text-lg font-extrabold text-orange-500 mb-4">
                SCT 및 TCI 기반 일상 회복 행동 지침
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    ["Mission 1.", "하루에 한 번, ‘오늘 내가 잘 버틴 것’ 한 가지를 적어보세요."],
                    ["Mission 2.", "걱정이 커질 때는 ‘지금 확인된 사실’과 ‘예상’을 나누어 적어보세요."],
                    ["Mission 3.", "거절이 어려운 상황에서는 짧은 문장으로 ‘잠시 생각해볼게요’라고 말해보세요."]
                ].map(([title, text]) => (
                    <div key={title} className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                        <p className="text-sm font-extrabold text-slate-900 mb-2">
                            {title}
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            {text}
                        </p>
                    </div>
                ))}
            </div>
        </div>

        <button
    type="button"
    onClick={() => {
        alert("PDF 다운로드 기능은 보고서 전용 PDF 엔진 구축 후 제공될 예정입니다. 현재는 온라인 보기로 확인해 주세요.");
    }}
    className="no-print w-full bg-emerald-700 text-white rounded-2xl py-4 text-sm font-extrabold hover:bg-emerald-800 transition"
>
    PDF 다운로드(준비중)
</button>

    </div>
)}
                         </div>

                     </div>
                 </div>
             )}


                {/* =====================================================
                    [V38] AI 결과상담 채팅 모달
                ===================================================== */}
                {aiResultCounselingOpen && activeAiReservation && (
                    <div className="fixed inset-0 z-[10020] bg-slate-950/70 p-3 sm:p-6 flex items-center justify-center">
                        <div className="w-full max-w-5xl h-[92vh] rounded-[2rem] bg-white shadow-2xl overflow-hidden flex flex-col">
                            <div className="border-b border-slate-100 px-5 py-4 sm:px-7 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-extrabold text-violet-700">검토·승인 결과보고서 기반</p>
                                    <h3 className="mt-1 text-xl font-extrabold text-slate-900">AI 결과상담</h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        남은 상담시간 {
                                            formatRemainingTime(
                                                getAiReservationState(activeAiReservation).remainingMs
                                            )
                                        }
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAiResultCounselingOpen(false)}
                                    className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
                                >
                                    닫기
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0">
                                <aside className="hidden lg:block lg:col-span-4 border-r border-slate-100 bg-violet-50/40 p-5 overflow-y-auto">
                                    <div className="rounded-2xl bg-white border border-violet-100 p-4">
                                        <p className="text-xs font-extrabold text-violet-700">상담자료</p>
                                        <h4 className="mt-2 text-sm font-extrabold text-slate-900">
                                            {activeApprovedReport?.title || '심리검사 결과보고서'}
                                        </h4>
                                        <p className="mt-2 text-xs text-slate-500">
                                            {activeApprovedReport?.testType || '검사결과'} · 임상심리사 승인
                                        </p>
                                    </div>
                                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-900 leading-relaxed">
                                        AI 결과상담은 승인된 결과보고서를 전반적으로 설명하고,
                                        내담자의 실제 경험과 연결해 이해하도록 돕습니다.
                                        진단을 새로 내리거나 보고서에 없는 내용을 단정하지 않습니다.
                                    </div>
                                </aside>

                                <section className="lg:col-span-8 flex flex-col min-h-0">
                                    <div ref={aiResultChatRef} className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4 bg-slate-50/50">
                                        {aiResultMessages.map((message, index) => (
                                            <div key={`${message.time}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[86%] rounded-3xl px-5 py-4 text-sm leading-relaxed whitespace-pre-line ${
                                                    message.role === 'user'
                                                        ? 'bg-violet-700 text-white rounded-br-md'
                                                        : 'bg-white border border-slate-100 text-slate-700 shadow-sm rounded-bl-md'
                                                }`}>
                                                    {message.text}
                                                    <div className={`mt-2 text-[10px] ${message.role === 'user' ? 'text-violet-200' : 'text-slate-400'}`}>
                                                        {message.time}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {aiResultThinking && (
                                            <div className="flex justify-start">
                                                <div className="rounded-3xl rounded-bl-md bg-white border border-slate-100 px-5 py-4 text-sm text-slate-500 shadow-sm">
                                                    결과보고서와 이야기를 함께 살펴보고 있습니다...
                                                </div>
                                            </div>
                                        )}

                                        {aiResultSummary && (
                                            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                                                <h4 className="text-sm font-extrabold text-emerald-800">오늘의 상담정리</h4>
                                                <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                                                    {aiResultSummary}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-slate-100 bg-white p-4 sm:p-5">
                                        {getAiReservationState(activeAiReservation).status === 'available' && !aiResultSummary ? (
                                            <div className="flex gap-3">
                                                <textarea
                                                    value={aiResultInput}
                                                    onChange={(e) => setAiResultInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            sendAiResultMessage();
                                                        }
                                                    }}
                                                    rows={2}
                                                    placeholder="결과에서 궁금한 점이나 실제 경험을 이야기해 주세요."
                                                    className="flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={sendAiResultMessage}
                                                    disabled={!aiResultInput.trim() || aiResultThinking}
                                                    className="rounded-2xl bg-violet-700 px-5 text-sm font-extrabold text-white disabled:bg-slate-200"
                                                >
                                                    보내기
                                                </button>
                                            </div>
                                        ) : !aiResultSummary ? (
                                            <button
                                                type="button"
                                                onClick={finishAiResultCounseling}
                                                className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-extrabold text-white"
                                            >
                                                예약시간이 종료되었습니다 · 상담정리 보기
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setAiResultCounselingOpen(false)}
                                                className="w-full rounded-2xl bg-emerald-700 py-3.5 text-sm font-extrabold text-white"
                                            >
                                                상담정리 저장하고 닫기
                                            </button>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                )}

                </div>
            );
        }
        const container = document.getElementById('root');
        const root = ReactDOM.createRoot(container);
        root.render(<App />);
    
