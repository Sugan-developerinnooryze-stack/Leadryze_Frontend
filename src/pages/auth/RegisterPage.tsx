import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function RegisterPage() {
  const { handleRegister, isLoading } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [companyName, setCompany] = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return; }
    handleRegister({ firstName, lastName, companyName, email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-blue-100 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-600">LeadRyze AI</h1>
          <p className="text-gray-500 mt-2">Create your account — it's free</p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="firstName">First Name</label>
                <input id="firstName" type="text" className="input" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label className="label" htmlFor="lastName">Last Name</label>
                <input id="lastName" type="text" className="input" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="company">Company Name <span className="text-gray-400">(optional)</span></label>
              <input id="company" type="text" className="input" value={companyName}
                placeholder="Your company or workspace name"
                onChange={(e) => setCompany(e.target.value)} />
            </div>

            <div>
              <label className="label" htmlFor="email">Work Email</label>
              <input id="email" type="email" className="input" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" className="input" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={8}
                placeholder="Min. 8 characters" />
            </div>

            <div>
              <label className="label" htmlFor="confirm">Confirm Password</label>
              <input id="confirm" type="password" className="input" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required />
            </div>

            <button type="submit" className="btn-primary w-full mt-2" disabled={isLoading}>
              {isLoading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 hover:underline font-medium">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          A verification email will be sent to confirm your address.
        </p>
      </div>
    </div>
  );
}
