import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Activity, Eye, EyeOff, Mail, Lock, User, Phone, MapPin, Calendar, Contact } from 'lucide-react';
import { toast } from 'sonner';
import { registerApi, roleToRoute } from '../../lib/api';
import { setAuthSession } from '../../lib/authStorage';
import { hasBookingData } from '../../lib/bookingService';
import { z } from 'zod';

/**
 * REGISTRATION SCHEMA
 * Defines validation rules for the patient registration form.
 */
const registerSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\d{9,10}$/, "Phone must be 9 or 10 digits"),
  password: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  confirmPassword: z.string(),
  dob: z.string().refine((date) => new Date(date) < new Date(), "Birth date must be in the past"),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  nationalId: z.string().min(6, "ID must be at least 6 digits"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    dob: '',
    gender: 'MALE' as const,
    address: '',
    nationalId: '',
  });
  const [county, setCounty] = useState('');
const [location, setLocation] = useState('');
const [errors, setErrors] = useState<{ dob?: string }>({});

  const kenyaLocations: Record<string, string[]> = {
  Nairobi: ['Westlands', 'Kasarani', 'Embakasi'],
  Nakuru: ['Njoro', 'Naivasha', 'Gilgil'],
  Mombasa: ['Nyali', 'Likoni', 'Changamwe'],
};


function getPasswordStrength(password: string) {
  if (password.length < 6) return { label: 'Very Weak', color: 'bg-red-500', width: '25%' };

  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSymbols = /[^a-zA-Z0-9]/.test(password);

  if (hasLetters && hasNumbers && hasSymbols) {
    return { label: 'Strong', color: 'bg-green-500', width: '100%' };
  }

  if (hasLetters && hasNumbers) {
    return { label: 'Medium', color: 'bg-orange-400', width: '60%' };
  }

  return { label: 'Weak', color: 'bg-red-400', width: '40%' };
}

  /**
   * HANDLE FORM SUBMISSION
   * Validates data with Zod and sends registration request to backend.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const validation = registerSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      toast.error(firstError.message);
      return;
    }

    if (!county || !location) {
      toast.error('Please select county and location');
      return;
    }

    const nameParts = formData.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || 'Patient';

    try {
      const res = await registerApi({
        firstName,
        lastName,
        email: formData.email,
        phoneNumber: formData.phone,
        password: formData.password,
        dob: formData.dob,
        gender: formData.gender,
        address: `${county}, ${location}`,
        nationalId: formData.nationalId,
      });
      
      if (res.role !== 'PATIENT' && res.role !== 'USER') {
        window.location.href = `http://localhost:5174/login?token=${res.accessToken}`;
        return;
      }

      setAuthSession(res.accessToken, res.role, res.userId);
      toast.success('Registration successful!');
      
      // Check if user has pending booking
      if (hasBookingData()) {
        console.log('Booking data found, redirecting to complete booking');
        navigate('/book-appointment'); // Go back to booking with data restored
      } else {
        navigate(roleToRoute(res.role));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="w-10 h-10 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">AfyaFlow</h1>
          </div>
          <p className="text-muted-foreground">Create your patient account</p>
        </div>

        {/* Register Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+254 700 000 000"
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>
            
            {/* National ID */}
            <div>
              <label htmlFor="nationalId" className="block text-sm font-medium mb-2">
                National ID / Passport
              </label>
              <div className="relative">
                <Contact className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="nationalId"
                  type="text"
                  value={formData.nationalId}
                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                  placeholder="ID Number"
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label htmlFor="dob" className="block text-sm font-medium mb-2">
                Date of Birth
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="dob"
                  type="text"
                  placeholder="Date of Birth (YYYY-MM-DD)"
                  onFocus={(e) => (e.target.type = "date")}
                  onBlur={(e) => (e.target.type = e.target.value ? "date" : "text")}
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              
              </div>
                {errors.dob && (
  <p className="text-red-500 text-sm mt-1">{errors.dob}</p>
)}
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="gender" className="block text-sm font-medium mb-2">
                Gender
              </label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'MALE' | 'FEMALE' | 'OTHER' })}
                className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Address */}
            <div>
  <label className="block text-sm font-medium mb-2">County</label>
  <select
    value={county}
    onChange={(e) => {
      setCounty(e.target.value);
      setLocation('');
    }}
    className="w-full px-4 py-3 bg-muted border border-border rounded-lg"
    required
  >
    <option value="">Select County</option>
    {Object.keys(kenyaLocations).map((c) => (
      <option key={c} value={c}>{c}</option>
    ))}
  </select>
</div>

<div>
  <label className="block text-sm font-medium mb-2">Location</label>
  <select
    value={location}
    onChange={(e) => setLocation(e.target.value)}
    className="w-full px-4 py-3 bg-muted border border-border rounded-lg"
    required
    disabled={!county}
  >
    <option value="">Select Location</option>
    {county && kenyaLocations[county].map((loc) => (
      <option key={loc} value={loc}>{loc}</option>
    ))}
  </select>
</div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
               {formData.password && (
  (() => {
    const strength = getPasswordStrength(formData.password);
    return (
      <div className="mt-2">
        <div className="w-full h-2 bg-gray-200 rounded">
          <div
            className={`h-2 rounded ${strength.color}`}
            style={{ width: strength.width }}
          />
        </div>
        <p className="text-xs mt-1 text-muted-foreground">{strength.label}</p>
      </div>
    );
  })()
)}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start">
              <input type="checkbox" className="mr-2 mt-1 rounded" required />
              <span className="text-sm text-muted-foreground">
                I agree to the <button type="button" className="text-primary hover:underline">Terms of Service</button> and <button type="button" className="text-primary hover:underline">Privacy Policy</button>
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Account
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <button 
                onClick={() => navigate('/login')}
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <button 
            onClick={() => navigate('/')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
