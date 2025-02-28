'use client';

import React, { useState, useEffect } from "react";
import Image from "next/image";
import AuthStatus from "@/components/auth/AuthStatus";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import CreateSession from "@/components/sessions/CreateSession";
import MySessionsList from "@/components/sessions/MySessionsList";
import { useRouter } from "next/navigation";
import { analytics } from '@/config/firebaseClient';
import { logEvent, Analytics } from 'firebase/analytics';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function Home() {
  const { user, updateUserProfile, loading: authLoading } = useAuth();
  const { currentSession, joinSession } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
    
    // Track page view
    if (analytics) {
      logEvent(analytics as Analytics, 'page_view', {
        page_title: 'Home',
        page_location: window.location.href,
        page_path: window.location.pathname
      });
    }
  }, [user, currentSession, router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setUpdateError('Display name cannot be empty');
      return;
    }

    try {
      setIsUpdating(true);
      setUpdateError(null);
      await updateUserProfile({ displayName });
      
      if (analytics) {
        logEvent(analytics as Analytics, 'update_profile', {
          user_id: user?.uid
        });
      }
    } catch (error: any) {
      setUpdateError(error.message || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSessionCreated = (sessionId: string) => {
    if (analytics) {
      logEvent(analytics as Analytics, 'create_session', {
        session_id: sessionId,
        user_id: user?.uid
      });
    }
    
    // Close modal and redirect to dashboard
    setIsCreateModalOpen(false);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold">G</span>
            </div>
            <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">GameTheory</h1>
          </div>
          <AuthStatus />
        </header>

        <main className="flex flex-col items-center">
          {/* Hero Section */}
          <div className="text-center mb-16 w-full max-w-4xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">
                Juegos Estratégicos
              </span>
              <br /> para Todos
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-8">
              Crea sesiones de juego y desafía tu pensamiento estratégico contra amigos y rivales
            </p>
            {!user && (
              <Link 
                href="/auth/signin" 
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full text-lg font-medium shadow-lg transform transition hover:scale-105"
              >
                Comenzar
              </Link>
            )}
          </div>

          {/* User Content when logged in */}
          {user && (
            <div className="w-full max-w-4xl bg-gray-800/50 backdrop-blur-sm p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-700">
              <h2 className="text-2xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">¡Bienvenido, Jugador!</h2>
              
              {/* Profile Section */}
              <div className="mb-10">
                <h3 className="text-xl font-semibold mb-4 text-gray-200">Tu Perfil de Jugador</h3>
                <form onSubmit={handleUpdateProfile} className="space-y-4 sm:space-y-0 sm:flex sm:flex-row sm:gap-4 sm:items-end">
                  <div className="flex-1">
                    <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-1">
                      Nombre de Usuario
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ingresa tu nombre de usuario"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full sm:w-auto px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                  >
                    {isUpdating ? 'Actualizando...' : 'Actualizar Perfil'}
                  </button>
                </form>
                {updateError && (
                  <p className="mt-2 text-red-400 text-sm">{updateError}</p>
                )}
              </div>
              
              {/* My Sessions Section */}
              <div className="mb-10">
                <h3 className="text-xl font-semibold mb-4 text-gray-200">Mis Sesiones</h3>
                <MySessionsList />
              </div>
              
              {/* Create Session Button & Modal */}
              <div className="mb-10 flex flex-col items-center">
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                  <DialogTrigger asChild>
                    <button className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full text-lg font-medium shadow-lg transform transition hover:scale-105">
                      Crear Nueva Sesión
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-800 text-white border border-gray-700 max-w-2xl">
                    <DialogHeader>
                      <div className="flex justify-between items-center">
                        <DialogTitle className="text-xl font-semibold text-gray-200">Crear una Nueva Sesión</DialogTitle>
                        <button 
                          onClick={() => setIsCreateModalOpen(false)}
                          className="text-gray-400 hover:text-white focus:outline-none"
                        >
                          <X size={24} />
                        </button>
                      </div>
                    </DialogHeader>
                    <div className="py-4">
                      <p className="text-gray-300 mb-4">
                        Crea una nueva sesión de juego y comparte el enlace o código QR con tus amigos para que se unan.
                      </p>
                      <CreateSession onSessionCreated={handleSessionCreated} />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              {/* Join Session Info Section */}
              <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                <h3 className="text-lg font-medium mb-2 text-gray-200">¿Cómo unirse a una sesión?</h3>
                <p className="text-gray-300 text-sm">
                  Las sesiones solo pueden unirse a través de un enlace directo o código QR compartido por el creador de la sesión.
                  Pide a tus amigos que compartan su enlace de sesión contigo para unirte a su juego.
                </p>
              </div>
            </div>
          )}
        </main>

        <footer className="mt-16 sm:mt-20 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} GameTheory. Todos los derechos reservados.</p>
        </footer>
      </div>
    </div>
  );
}
