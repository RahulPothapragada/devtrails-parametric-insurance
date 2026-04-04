import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  User, Phone, Mail, CreditCard, Shield, Fingerprint,
  Smartphone, Calendar, Hash, ArrowRight, Loader2,
  AlertCircle, CheckCircle2, ChevronLeft, Lock, Wallet
} from 'lucide-react';

import { API_BASE } from '@/lib/api';
const API = API_BASE;

type AuthView = 'choice' | 'login' | 'otp' | 'signup';

export default function RiderAuth() {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>('choice');

  // Login state
  const [loginPhone, setLoginPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  // Signup state
  const [form, setForm] = useState({
    name: '', phone: '', email: '', dob: '', aadhaar: '',
    bank_account: '', bank_ifsc: '', upi_id: '', imei: '', age: '',
    password: '', confirmPassword: '',
  });
  const [signupLoading, setSignupLoading] = useState(false);

  // Shared
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateForm = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  // ── Send OTP ──
  const handleSendOtp = async () => {
    if (loginPhone.length !== 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }
    setOtpSending(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send OTP');
      setDemoOtp(data.demo_otp || '');
      setView('otp');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  };

  // ── Verify OTP ──
  const handleVerifyOtp = async () => {
    if (otp.length !== 4) {
      setError('Enter the 4-digit OTP');
      return;
    }
    setOtpVerifying(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'OTP verification failed');
      localStorage.setItem('flowsecure_token', data.access_token);
      localStorage.setItem('flowsecure_rider_name', data.name);
      navigate('/rider');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── Signup ──
  const handleSignup = async () => {
    setError('');
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.phone.length !== 10) { setError('Valid 10-digit phone required'); return; }
    if (!form.dob) { setError('Date of Birth is required'); return; }
    if (!form.age) { setError('Age is required'); return; }
    if (!form.email || !form.email.includes('@')) { setError('Valid email is required'); return; }
    if (!form.aadhaar || form.aadhaar.length !== 12) { setError('Valid 12-digit Aadhaar is required'); return; }
    if (!form.imei) { setError('IMEI is required'); return; }
    if (!form.bank_account) { setError('Bank Account Number is required'); return; }
    if (!form.bank_ifsc || form.bank_ifsc.length < 5) { setError('Valid Bank IFSC is required'); return; }
    if (!form.upi_id || !form.upi_id.includes('@')) { setError('Valid UPI ID is required (e.g. name@bank)'); return; }

    setSignupLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          dob: form.dob,
          aadhaar: form.aadhaar,
          bank_account: form.bank_account,
          bank_ifsc: form.bank_ifsc,
          upi_id: form.upi_id,
          imei: form.imei,
          age: parseInt(form.age),
          password: form.password,
          zone_id: 1,
          shift_type: 'morning',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');

      localStorage.setItem('flowsecure_token', data.access_token);
      localStorage.setItem('flowsecure_rider_name', data.name);
      setSuccess('Account created successfully!');
      setTimeout(() => navigate('/rider'), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <AnimatePresence mode="wait">
          {/* ── Choice Screen ── */}
          {view === 'choice' && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-6"
            >
              {/* Branding */}
              <div className="text-center mb-2">
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                  <Shield className="w-8 h-8 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Welcome to FlowSecure</h1>
                <p className="text-muted-foreground text-sm mt-1">Parametric income protection for gig workers</p>
              </div>

              {/* Login Card */}
              <button
                onClick={() => setView('login')}
                className="group w-full rounded-xl border bg-card p-5 flex items-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all text-left shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-base">Login</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Sign in with phone number & OTP</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              {/* Signup Card */}
              <button
                onClick={() => setView('signup')}
                className="group w-full rounded-xl border bg-card p-5 flex items-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all text-left shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-[#0ea5e9]/10 flex items-center justify-center shrink-0 group-hover:bg-[#0ea5e9]/20 transition-colors">
                  <User className="w-6 h-6 text-[#0ea5e9]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-base">Sign Up</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Create your rider account</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#0ea5e9] transition-colors" />
              </button>

              {/* Subtle footer */}
              <p className="text-center text-[10px] text-muted-foreground mt-2">
                Protected by 9-Wall Adversarial Defense · AES-256 Encrypted
              </p>
            </motion.div>
          )}

          {/* ── Login: Phone Entry ── */}
          {view === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-5"
            >
              <button onClick={() => { setView('choice'); setError(''); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <div>
                <h2 className="text-xl font-bold text-foreground">Login to your account</h2>
                <p className="text-sm text-muted-foreground mt-1">We'll send a verification code to your phone</p>
              </div>

              <div className="rounded-xl border bg-card p-6 flex flex-col gap-4 shadow-sm">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Phone Number</label>
                  <div className="flex items-center gap-2 border rounded-xl px-4 h-12 bg-muted/20 focus-within:border-primary/50 transition-colors">
                    <span className="text-sm text-muted-foreground font-medium">+91</span>
                    <div className="w-px h-5 bg-border" />
                    <input
                      type="tel"
                      placeholder="Enter 10-digit mobile"
                      value={loginPhone}
                      onChange={e => { setLoginPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                      className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none text-sm font-medium"
                    />
                    <Phone className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-red-400">{error}</span>
                  </div>
                )}

                <button
                  onClick={handleSendOtp}
                  disabled={otpSending || loginPhone.length !== 10}
                  className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {otpSending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</>
                  ) : (
                    <><Lock className="w-4 h-4" /> Send OTP</>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Login: OTP Verification ── */}
          {view === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-5"
            >
              <button onClick={() => { setView('login'); setError(''); setOtp(''); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <div>
                <h2 className="text-xl font-bold text-foreground">Verify OTP</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the code sent to <span className="font-semibold text-foreground">+91 {loginPhone}</span>
                </p>
              </div>

              <div className="rounded-xl border bg-card p-6 flex flex-col gap-4 shadow-sm">
                {/* Demo OTP hint */}
                {demoOtp && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                    <Fingerprint className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">
                      Demo OTP: <span className="font-mono font-bold text-primary text-sm">{demoOtp}</span>
                    </span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">4-Digit OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="• • • •"
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
                    className="w-full h-14 bg-muted/20 border rounded-xl px-4 text-center text-2xl font-mono font-bold tracking-[0.5em] text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/50 transition-colors"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-red-400">{error}</span>
                  </div>
                )}

                <button
                  onClick={handleVerifyOtp}
                  disabled={otpVerifying || otp.length !== 4}
                  className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {otpVerifying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Verify & Login</>
                  )}
                </button>

                <button
                  onClick={handleSendOtp}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors text-center"
                >
                  Didn't receive it? Resend OTP
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Signup / Registration Form ── */}
          {view === 'signup' && (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-5"
            >
              <button onClick={() => { setView('choice'); setError(''); setSuccess(''); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <div>
                <h2 className="text-xl font-bold text-foreground">Create Rider Account</h2>
                <p className="text-sm text-muted-foreground mt-1">Fill in your details to get started</p>
              </div>

              <div className="rounded-xl border bg-card p-6 flex flex-col gap-5 shadow-sm max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {/* Personal Info Section */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Personal Information
                  </h3>

                  <InputField
                    icon={<User className="w-4 h-4" />}
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={v => updateForm('name', v)}
                    required
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <InputField
                      icon={<Calendar className="w-4 h-4" />}
                      label="Date of Birth"
                      placeholder="YYYY-MM-DD"
                      type="date"
                      value={form.dob}
                      onChange={v => updateForm('dob', v)}
                      required
                    />
                    <InputField
                      icon={<Hash className="w-4 h-4" />}
                      label="Age"
                      placeholder="e.g. 25"
                      type="number"
                      value={form.age}
                      onChange={v => updateForm('age', v)}
                      required
                    />
                  </div>

                  <InputField
                    icon={<Phone className="w-4 h-4" />}
                    label="Mobile Number"
                    placeholder="10-digit mobile"
                    value={form.phone}
                    onChange={v => updateForm('phone', v.replace(/\D/g, '').slice(0, 10))}
                    prefix="+91"
                    required
                  />

                  <InputField
                    icon={<Mail className="w-4 h-4" />}
                    label="Email"
                    placeholder="rider@example.com"
                    type="email"
                    value={form.email}
                    onChange={v => updateForm('email', v)}
                    required
                  />
                </div>

                {/* Separator */}
                <div className="h-px bg-border" />

                {/* KYC / Identity Section */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Fingerprint className="w-3.5 h-3.5" /> Identity Verification
                  </h3>

                  <InputField
                    icon={<Fingerprint className="w-4 h-4" />}
                    label="Aadhaar Number"
                    placeholder="XXXX XXXX XXXX"
                    value={form.aadhaar.replace(/(\d{4})(?=\d)/g, '$1 ')}
                    onChange={v => updateForm('aadhaar', v.replace(/\D/g, '').slice(0, 12))}
                    required
                  />

                  <InputField
                    icon={<Smartphone className="w-4 h-4" />}
                    label="IMEI Number"
                    placeholder="Device IMEI"
                    value={form.imei}
                    onChange={v => updateForm('imei', v)}
                    required
                  />
                </div>

                {/* Separator */}
                <div className="h-px bg-border" />

                {/* Bank Details Section */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5" /> Bank Details
                  </h3>

                  <InputField
                    icon={<CreditCard className="w-4 h-4" />}
                    label="Bank Account Number"
                    placeholder="Account number"
                    value={form.bank_account}
                    onChange={v => updateForm('bank_account', v)}
                    required
                  />

                  <InputField
                    icon={<Hash className="w-4 h-4" />}
                    label="IFSC Code"
                    placeholder="e.g. SBIN0001234"
                    value={form.bank_ifsc}
                    onChange={v => updateForm('bank_ifsc', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
                    required
                  />

                  <InputField
                    icon={<Wallet className="w-4 h-4" />}
                    label="UPI ID"
                    placeholder="e.g. name@paytm"
                    value={form.upi_id}
                    onChange={v => updateForm('upi_id', v.toLowerCase().replace(/\s/g, ''))}
                    required
                  />
                </div>

                {/* Separator */}
                <div className="h-px bg-border" />

                {/* Password Section */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5" /> Security
                  </h3>

                  <InputField
                    icon={<Lock className="w-4 h-4" />}
                    label="Password"
                    placeholder="Min. 6 characters"
                    type="password"
                    value={form.password}
                    onChange={v => updateForm('password', v)}
                    required
                  />

                  <InputField
                    icon={<Lock className="w-4 h-4" />}
                    label="Confirm Password"
                    placeholder="Re-enter password"
                    type="password"
                    value={form.confirmPassword}
                    onChange={v => updateForm('confirmPassword', v)}
                    required
                  />
                </div>
              </div>

              {/* Error / Success */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-red-400">{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-primary font-semibold">{success}</span>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSignup}
                disabled={signupLoading}
                className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {signupLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account...</>
                ) : (
                  <><Shield className="w-4 h-4" /> Create Account & Get Protected</>
                )}
              </button>

              <p className="text-center text-[10px] text-muted-foreground">
                By signing up, you agree to FlowSecure's Terms of Service & Privacy Policy
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}


// ── Reusable Input Component ──
function InputField({
  icon, label, placeholder, value, onChange, type = 'text', prefix, required
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  prefix?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
        {label} {required && <span className="text-primary">*</span>}
      </label>
      <div className="flex items-center gap-2 border rounded-xl px-3 h-10 bg-muted/20 focus-within:border-primary/50 transition-colors">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        {prefix && (
          <>
            <span className="text-xs text-muted-foreground font-medium">{prefix}</span>
            <div className="w-px h-4 bg-border" />
          </>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/40 outline-none text-sm"
        />
      </div>
    </div>
  );
}
