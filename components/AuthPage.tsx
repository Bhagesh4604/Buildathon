import React, { useState } from 'react';
import { UserRole } from '../types';
import { apiLogin, getProfile } from '../services/api';
import { GraduationCap, LayoutDashboard, ArrowRight, Loader2, BookOpen } from 'lucide-react';
import { NeonOrbs } from './NeonOrbs';
import { TextShimmer } from './TextShimmer';
import { GlowingEffect } from './GlowingEffect';

interface AuthPageProps {
  onLogin: (user: any, role: UserRole) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subject, setSubject] = useState(''); // For Teacher

    const handleSignUp = async (e: React.FormEvent) => {

      e.preventDefault();

      setError(null);

      setIsLoading(true);

  

      // In a real application, you would send a request to your backend here

      // to create a new user. For this example, we'll just log the data.

      console.log({ name, email, password, role });

      setIsLoading(false);

    };

  

    const handleSubmit = async (e: React.FormEvent) => {

      e.preventDefault();

      setError(null);

      setIsLoading(true);

  

      try {

        const { access_token } = await apiLogin(email, password);

        localStorage.setItem('token', access_token);

        const user = await getProfile(access_token);

        onLogin(user, user.role);

      } catch (error) {

        setError(error.message);

      }

  

      setIsLoading(false);

    };

  

  

  

    const handleRoleChange = (newRole: UserRole) => {

      setRole(newRole);

      setError(null);

    };

  

    return (

      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">

        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">

          

          {/* Left Side - Brand/Visual */}

          <div className="md:w-1/2 bg-gradient-to-br from-indigo-600 to-violet-700 p-8 flex flex-col justify-between text-white relative overflow-hidden">

            

            {/* Animated Background */}

            <NeonOrbs />

  

            <div className="relative z-10">

              <div className="flex items-center space-x-2 mb-4">

                 <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">

                   <span className="font-bold text-xl">H</span>

                 </div>

                 <span className="text-2xl font-bold">H²-ALA</span>

              </div>

              

              <TextShimmer className="text-3xl font-bold mb-4 block" duration={3}>

                {"Hybrid Human-AI Learning Assistant"}

              </TextShimmer>

              

              <p className="text-indigo-100 leading-relaxed">

                Experience the future of education with our Socratic AI tutor, personalized learning paths, and real-time teacher intervention.

              </p>

            </div>

            

            <div className="relative z-10 mt-12 space-y-4">

              <div className="flex items-center space-x-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">

                <BookOpen className="w-6 h-6 text-indigo-200" />

                <div>

                  <p className="font-bold">Adaptive Learning</p>

                  <p className="text-xs text-indigo-200">Personalized content based on mastery.</p>

                </div>

              </div>

            </div>

          </div>

  

          {/* Right Side - Form */}

          <div className="md:w-1/2 p-8 md:p-12">

            <div className="flex justify-between items-center mb-8">

              <h2 className="text-2xl font-bold text-gray-800">

                {isSignUp ? 'Sign Up' : 'Sign In'}

              </h2>

              <button

                onClick={() => setIsSignUp(!isSignUp)}

                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"

              >

                {isSignUp ? 'Sign In' : 'Sign Up'}

              </button>

              <div className="flex bg-gray-100 p-1 rounded-lg">

                <button 

                  onClick={() => handleRoleChange(UserRole.STUDENT)}

                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center space-x-1 ${role === UserRole.STUDENT ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}

                >

                  <GraduationCap className="w-3 h-3" />

                  <span>Student</span>

                </button>

                <button 

                  onClick={() => handleRoleChange(UserRole.TEACHER)}

                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center space-x-1 ${role === UserRole.TEACHER ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}

                >

                  <LayoutDashboard className="w-3 h-3" />

                  <span>Teacher</span>

                </button>

              </div>

            </div>

            <form onSubmit={isSignUp ? handleSignUp : handleSubmit} className="space-y-4">

              {isSignUp && (

                <div>

                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Full Name</label>

                  <input

                    type="text"

                    required

                    value={name}

                    onChange={(e) => setName(e.target.value)}

                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"

                    placeholder="John Doe"

                  />

                </div>

              )}

              

              <div>

                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email Address</label>

                <input

                  type="email"

                  required

                  value={email}

                  onChange={(e) => setEmail(e.target.value)}

                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"

                  placeholder={role === UserRole.STUDENT ? "student@example.com" : "teacher@school.edu"}

                />

              </div>

  

              <div>

                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Password</label>

                <input

                  type="password"

                  required

                  value={password}

                  onChange={(e) => setPassword(e.target.value)}

                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"

                  placeholder="••••••••"

                />

              </div>

  

              {isSignUp && role === UserRole.TEACHER && (

                <div>

                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Subject</label>

                  <input

                    type="text"

                    required

                    value={subject}

                    onChange={(e) => setSubject(e.target.value)}

                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"

                    placeholder="e.g. Mathematics"

                  />

                </div>

              )}

  

              {error && (

                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">

                  {error}

                </div>

              )}

  

              <div className="relative group rounded-xl">

                <GlowingEffect 

                  spread={40}

                  glow={true}

                  disabled={false}

                  proximity={64}

                  inactiveZone={0.01}

                  borderWidth={2}

                  className="rounded-xl z-0"

                />

                

                <button

                  type="submit"

                  disabled={isLoading}

                  className={`relative z-10 w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform flex items-center justify-center space-x-2

                    ${role === UserRole.STUDENT ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700'}

                  `}

                >

                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>}

                  {!isLoading && <ArrowRight className="w-5 h-5" />}

                </button>

              </div>

            </form>

            

            <div className="mt-8 pt-6 border-t border-gray-100 text-center">

               <p className="text-xs text-gray-400">Demo Credentials:</p>

               <p className="text-xs text-gray-500 mt-1">

                 <span className="font-medium">Student:</span> alice@example.com / password123

               </p>

               <p className="text-xs text-gray-500">

                 <span className="font-medium">Teacher:</span> teacher@school.edu / Bhagesh@4604

               </p>

            </div>

          </div>

        </div>

      </div>

    );

  