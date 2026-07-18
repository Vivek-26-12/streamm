import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext.jsx';
import { mediaApi, getAuthenticatedMediaUrl } from '../api/client.js';
import { useNavigate } from 'react-router-dom';
import { 
  Film, LogOut, RefreshCw, Search, Play, Clock, 
  Tv, Database, Info, X, ChevronRight
} from 'lucide-react';

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filters State
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('added_at_desc');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedSubId, setSelectedSubId] = useState('');

  // Local storage continue watching progress list (Disabled per user preference)
  const [continueList, setContinueList] = useState([]);

  useEffect(() => {
    try {
      localStorage.removeItem('streamm_progress');
    } catch (_) {}
    setContinueList([]);
  }, [selectedMovie]);

  // 1. Query dynamic files list
  const { data: movies = [], isLoading: loadingMovies, refetch } = useQuery({
    queryKey: ['movies', search, sort],
    queryFn: () => mediaApi.getMovies({ q: search, sort }).then(res => res.data),
  });

  // 2. Movie Details Queries (runs on clicking a file)
  const [movieDetails, setMovieDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [movieProgress, setMovieProgress] = useState(null);

  const handleSelectMovie = async (movie) => {
    setSelectedMovie(movie);
    setLoadingDetails(true);
    try {
      const res = await mediaApi.getMovie(movie.id);
      setMovieDetails(res.data);
      
      // Progress tracking disabled
      setMovieProgress(null);

      // Auto select first subtitle track if available
      if (res.data.subtitles && res.data.subtitles.length > 0) {
        setSelectedSubId(res.data.subtitles[0].id.toString());
      } else {
        setSelectedSubId('');
      }
    } catch (error) {
      console.error('Failed to load movie details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedMovie(null);
    setMovieDetails(null);
    setMovieProgress(null);
  };

  // Start playback
  const handlePlayMovie = (movieId, startTime = 0, subId = '') => {
    navigate(`/player/${movieId}?start=${startTime}&subId=${subId}`);
  };

  const formatDuration = (secs) => {
    if (!secs) return '0 min';
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins} min`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 flex flex-col pb-16">
      {/* Header bar */}
      <header className="sticky top-0 z-40 glass-nav px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-brand-500 to-indigo-400 rounded-xl flex items-center justify-center shadow-glow-brand">
            <Film className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-wider text-white">
            Stream<span className="text-brand-500">m</span>
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => refetch()}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh files</span>
          </button>

          <button
            onClick={logout}
            className="flex items-center space-x-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 px-3.5 py-2 rounded-lg text-sm text-red-400 font-semibold transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 mt-8 space-y-10">
        
        {/* Continue Watching Section (localStorage bound) */}
        {continueList.length > 0 && (
          <section className="space-y-4 fade-in">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-brand-400" />
              <h2 className="text-lg font-bold tracking-tight text-white">Continue Watching</h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {continueList.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => handlePlayMovie(item.id, item.position)}
                  className="group relative rounded-xl overflow-hidden glass-card cursor-pointer"
                >
                  <div className="aspect-[2/3] w-full bg-slate-900 relative overflow-hidden">
                    <img 
                      src={getAuthenticatedMediaUrl(`/api/movie/${item.id}/poster`)} 
                      alt={item.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-300">
                      <div className="w-12 h-12 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-glow-brand scale-90 group-hover:scale-100 transition duration-300">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 space-y-1 bg-slate-900/80">
                    <h3 className="font-bold text-sm truncate text-white group-hover:text-brand-300 transition">
                      {item.title}
                    </h3>
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>{Math.floor((item.duration - item.position) / 60)}m left</span>
                      <span>{Math.round(item.completion_percentage)}% done</span>
                    </div>

                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
                      <div 
                        className="bg-brand-500 h-full rounded-full" 
                        style={{ width: `${item.completion_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Media Library */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold tracking-tight text-white">Files Library</h2>
              <span className="text-xs bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-400 font-medium">
                {movies.length} items
              </span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search file names..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-lg glass-input"
                />
              </div>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg glass-input"
              >
                <option value="added_at_desc">Recently Added</option>
                <option value="added_at_asc">Oldest Added</option>
                <option value="title_asc">Title A-Z</option>
                <option value="title_desc">Title Z-A</option>
              </select>
            </div>
          </div>

          {/* Grid Layout */}
          {loadingMovies ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <RefreshCw className="w-10 h-10 animate-spin text-brand-500 mb-4" />
              <span>Scanning directories dynamically...</span>
            </div>
          ) : movies.length === 0 ? (
            <div className="text-center py-20 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
              <Tv className="w-12 h-12 mx-auto mb-4 text-slate-700" />
              <p className="font-medium text-lg">No media files found</p>
              <p className="text-sm text-slate-600 mt-1 max-w-sm mx-auto">
                Place movies or shows in the configured folders on your PC and refresh.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {movies.map(movie => (
                <div 
                  key={movie.id} 
                  onClick={() => handleSelectMovie(movie)}
                  className="group relative rounded-xl overflow-hidden glass-card cursor-pointer"
                >
                  <div className="aspect-[2/3] w-full bg-slate-900 relative overflow-hidden">
                    <img 
                      src={getAuthenticatedMediaUrl(movie.poster_path)} 
                      alt={movie.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-2 right-2">
                      <span className="text-[8px] font-extrabold bg-slate-950/85 text-indigo-300 px-1.5 py-0.5 rounded backdrop-blur uppercase">
                        {movie.container}
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-300">
                      <div className="w-11 h-11 bg-slate-900/90 border border-slate-700 rounded-full flex items-center justify-center text-white scale-90 group-hover:scale-100 transition duration-300">
                        <Info className="w-5 h-5 text-indigo-400" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 space-y-1 bg-slate-900/40">
                    <h3 className="font-bold text-xs truncate text-slate-200 group-hover:text-brand-400 transition">
                      {movie.title}
                    </h3>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                      <span>{formatBytes(movie.file_size)}</span>
                      <span className="text-slate-600">click to info</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Details Modal */}
      {selectedMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-sm transition duration-300 fade-in">
          <div className="w-full max-w-2xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-y-auto shadow-2xl relative flex flex-col">
            <button 
              onClick={handleCloseModal}
              className="absolute top-4 right-4 z-10 w-9 h-9 bg-slate-950/50 hover:bg-slate-950 text-slate-400 hover:text-white rounded-full flex items-center justify-center border border-slate-800/80 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {loadingDetails || !movieDetails ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-500">
                <RefreshCw className="w-10 h-10 animate-spin text-brand-500 mb-4" />
                <span>Running dynamic FFprobe analysis...</span>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-2/5 h-48 sm:h-56 md:h-auto md:min-h-[430px] bg-slate-950 relative overflow-hidden flex-shrink-0">
                  <img 
                    src={getAuthenticatedMediaUrl(movieDetails.poster_path)} 
                    alt={movieDetails.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                    <button
                      onClick={() => handlePlayMovie(movieDetails.id, 0, selectedSubId)}
                      className="w-14 h-14 md:w-16 md:h-16 bg-brand-500 hover:bg-brand-600 rounded-full flex items-center justify-center text-white shadow-glow-brand transform hover:scale-105 active:scale-95 transition"
                    >
                      <Play className="w-5 h-5 md:w-6 md:h-6 fill-white ml-0.5 md:ml-1" />
                    </button>
                  </div>
                </div>

                <div className="w-full md:w-3/5 p-4 sm:p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg sm:text-xl font-black text-white leading-tight pr-8">{movieDetails.title}</h2>
                      <span className="text-[9px] text-brand-400 font-extrabold uppercase tracking-widest bg-brand-500/10 px-2 py-0.5 rounded">DYNAMIC MOUNT</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <span className="text-[9px] sm:text-[10px] bg-slate-800 border border-slate-700/50 text-slate-300 px-2 py-0.5 rounded font-semibold uppercase">{movieDetails.container}</span>
                      <span className="text-[9px] sm:text-[10px] bg-slate-800 border border-slate-700/50 text-slate-300 px-2 py-0.5 rounded font-semibold">{movieDetails.resolution}</span>
                      <span className="text-[9px] sm:text-[10px] bg-slate-800 border border-slate-700/50 text-slate-300 px-2 py-0.5 rounded font-semibold">{formatDuration(movieDetails.duration)}</span>
                      <span className="text-[9px] sm:text-[10px] bg-slate-800 border border-slate-700/50 text-slate-300 px-2 py-0.5 rounded font-semibold">{formatBytes(movieDetails.file_size)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:text-xs border-t border-slate-800 pt-3 text-slate-400">
                      <div>
                        Video Codec: <span className="font-semibold text-slate-200 uppercase">{movieDetails.video_codec}</span>
                      </div>
                      <div>
                        Audio Codec: <span className="font-semibold text-slate-200 uppercase">{movieDetails.audio_codec}</span>
                      </div>
                      <div>
                        Frame Rate: <span className="font-semibold text-slate-200">{movieDetails.frame_rate} fps</span>
                      </div>
                      <div>
                        Audio Lang: <span className="font-semibold text-slate-200 uppercase">{movieDetails.language}</span>
                      </div>
                    </div>

                    {/* Subtitle list */}
                    <div className="border-t border-slate-800 pt-3 space-y-1.5">
                      <label className="block text-slate-300 text-[11px] sm:text-xs font-semibold">Subtitles Track</label>
                      {movieDetails.subtitles && movieDetails.subtitles.length > 0 ? (
                        <select
                          value={selectedSubId}
                          onChange={(e) => setSelectedSubId(e.target.value)}
                          className="w-full text-xs px-3 py-2.5 rounded-lg glass-input cursor-pointer"
                        >
                          <option value="">No subtitles (Direct Stream)</option>
                          {movieDetails.subtitles.map(sub => (
                            <option key={sub.id} value={sub.id}>
                              [{ (sub.type || '').toUpperCase() }] { (sub.language || '').toUpperCase() } ({ (sub.codec || '').toUpperCase() })
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-slate-500 text-xs italic bg-slate-950/30 p-2.5 rounded-lg border border-slate-800/40">
                          No subtitle tracks found in container or directory.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => handlePlayMovie(movieDetails.id, 0, selectedSubId)}
                        className="flex-1 py-3 sm:py-3.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold rounded-xl transition text-sm flex items-center justify-center space-x-2 shadow-glow-brand"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Play Movie</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
