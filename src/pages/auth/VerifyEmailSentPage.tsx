import { Link } from 'react-router-dom';

export default function VerifyEmailSentPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-blue-100 px-4">
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-6">📧</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Check your email</h1>
        <p className="text-gray-500 mb-6">
          We've sent a verification link to your email address.<br />
          Click the link to activate your account.
        </p>
        <div className="card text-left space-y-3 text-sm text-gray-600">
          <p>✅ Check your inbox (and spam folder)</p>
          <p>✅ Click the verification link</p>
          <p>✅ Come back here to sign in</p>
        </div>
        <Link to="/login" className="btn-primary inline-block mt-6">Back to Sign In</Link>
      </div>
    </div>
  );
}
