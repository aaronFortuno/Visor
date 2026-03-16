import { useState, useEffect } from "react";
import { createSession, fetchServerInfo, fetchOllamaModels } from "../lib/api";
import type { Session } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (session: Session) => void;
}

interface Project {
  name: string;
  path: string;
  markers: string[];
}

interface Agent {
  label: string;
  type: string;
  command: string;
  isOllama?: boolean;
}

function getAgents(defaultShell: string): Agent[] {
  return [
    { label: "opencode", type: "opencode", command: "opencode" },
    { label: "Claude Code", type: "claude-code", command: "claude" },
    { label: "Ollama", type: "ollama", command: "ollama", isOllama: true },
    { label: "Shell", type: "custom", command: defaultShell },
  ];
}

export function CreateSessionModal({ open, onClose, onCreated }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState(getAgents("powershell.exe"));
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [customCwd, setCustomCwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ollamaModels, setOllamaModels] = useState<Array<{ name: string; size: number }>>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");

  // Fetch projects and server info on open
  useEffect(() => {
    if (!open) return;
    fetch("/api/projects", {
      headers: { Authorization: `Bearer ${localStorage.getItem("visor-token") || ""}` },
    })
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});

    fetchServerInfo()
      .then((info) => setAgents(getAgents(info.defaultShell)))
      .catch(() => {});
  }, [open]);

  // Load Ollama models when the Ollama agent is selected
  const currentAgent = agents[selectedAgent];
  useEffect(() => {
    if (!open || !currentAgent?.isOllama) return;
    setOllamaModelsLoading(true);
    fetchOllamaModels()
      .then((models) => {
        setOllamaModels(models);
        if (models.length > 0 && !selectedModel) {
          setSelectedModel(models[0].name);
        }
      })
      .finally(() => setOllamaModelsLoading(false));
  }, [open, currentAgent?.isOllama]); // eslint-disable-line

  if (!open) return null;

  const agent = agents[selectedAgent];
  const isOllama = !!agent.isOllama;
  const cwd = selectedProject?.path || customCwd;

  const handleLaunch = async () => {
    if (isOllama) {
      if (!selectedModel) { setError("Select an Ollama model"); return; }
    } else {
      if (!cwd) { setError("Select a project or enter a directory"); return; }
    }
    setError("");
    setLoading(true);
    try {
      if (isOllama) {
        const name = `Ollama (${selectedModel})`;
        const session = await createSession({
          name,
          type: "ollama",
          command: "ollama",
          args: [selectedModel],
          cwd: ".",
          autoStart: false,
        });
        onCreated(session);
      } else {
        const name = `${selectedProject?.name || "session"} (${agent.label})`;
        const session = await createSession({
          name,
          type: agent.type,
          command: agent.command,
          cwd,
          autoStart: true,
        });
        onCreated(session);
      }
      onClose();
      setSelectedProject(null);
      setCustomCwd("");
      setSelectedModel("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markerIcon = (markers: string[]) => {
    if (markers.includes("package.json")) return "JS";
    if (markers.includes("go.mod")) return "Go";
    if (markers.includes("Cargo.toml")) return "Rs";
    if (markers.includes("pyproject.toml")) return "Py";
    if (markers.includes(".sln")) return "C#";
    if (markers.includes("pom.xml")) return "Jv";
    return "  ";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-visor-card border border-visor-border rounded-t-xl sm:rounded-xl animate-fade-in max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-semibold text-white mb-4">New Session</h2>

          {/* Agent selector */}
          <div className="flex gap-2 mb-4">
            {agents.map((a, i) => (
              <button
                key={a.label}
                onClick={() => setSelectedAgent(i)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  selectedAgent === i
                    ? "border-visor-accent bg-visor-accent/10 text-white"
                    : "border-visor-border text-gray-400 hover:border-gray-500"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content area — Ollama model picker or project list */}
        <div className="flex-1 overflow-y-auto px-5 border-t border-visor-border">
          {isOllama ? (
            <>
              <p className="text-xs text-gray-500 mt-3 mb-2 uppercase tracking-wider font-semibold">Select model</p>

              {ollamaModelsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-visor-accent border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-gray-400">Loading models...</span>
                </div>
              ) : ollamaModels.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400 mb-2">Ollama not available</p>
                  <p className="text-xs text-gray-500">
                    Install from{" "}
                    <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-visor-accent underline hover:text-indigo-400">
                      ollama.ai
                    </a>{" "}
                    and pull a model to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 mb-3">
                  {ollamaModels.map((m) => (
                    <button
                      key={m.name}
                      onClick={() => setSelectedModel(m.name)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        selectedModel === m.name
                          ? "bg-visor-accent/15 border border-visor-accent/30"
                          : "hover:bg-visor-bg border border-transparent"
                      }`}
                    >
                      <span className="shrink-0 w-7 h-7 flex items-center justify-center bg-purple-500/15 rounded text-[10px] font-bold text-purple-400 border border-purple-500/30">
                        AI
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${selectedModel === m.name ? "text-white" : "text-gray-300"}`}>
                          {m.name}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          {m.size ? `${(m.size / 1e9).toFixed(1)} GB` : ""}
                        </p>
                      </div>
                      {selectedModel === m.name && (
                        <svg className="w-4 h-4 text-visor-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mt-3 mb-2 uppercase tracking-wider font-semibold">Select project</p>

              {projects.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No projects found in ~/Projects</p>
              ) : (
                <div className="space-y-1">
                  {projects.map((p) => (
                    <button
                      key={p.path}
                      onClick={() => { setSelectedProject(p); setCustomCwd(""); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        selectedProject?.path === p.path
                          ? "bg-visor-accent/15 border border-visor-accent/30"
                          : "hover:bg-visor-bg border border-transparent"
                      }`}
                    >
                      <span className="shrink-0 w-7 h-7 flex items-center justify-center bg-visor-bg rounded text-[10px] font-bold text-gray-400 border border-visor-border">
                        {markerIcon(p.markers)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${selectedProject?.path === p.path ? "text-white" : "text-gray-300"}`}>
                          {p.name}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono truncate">{p.path}</p>
                      </div>
                      {p.markers.includes(".git") && (
                        <span className="shrink-0 text-[10px] text-gray-500">git</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom directory input */}
              <div className="mt-3 mb-3">
                <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-semibold">Or enter path</p>
                <input
                  type="text"
                  value={customCwd}
                  onChange={(e) => { setCustomCwd(e.target.value); setSelectedProject(null); }}
                  placeholder="C:\path\to\project"
                  className="w-full px-3 py-2 bg-visor-bg border border-visor-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-visor-accent text-sm font-mono"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-visor-border shrink-0">
          {error && <p className="text-visor-red text-sm mb-2">{error}</p>}

          {isOllama ? (
            selectedModel && (
              <p className="text-xs text-gray-500 mb-3 truncate">
                Ollama with <span className="text-purple-400 font-mono">{selectedModel}</span>
              </p>
            )
          ) : (
            cwd && (
              <p className="text-xs text-gray-500 mb-3 truncate">
                {agent.label} in <span className="text-gray-300 font-mono">{cwd}</span>
              </p>
            )
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-visor-border rounded-lg text-gray-400 hover:text-white transition-colors text-sm">
              Cancel
            </button>
            <button
              onClick={handleLaunch}
              disabled={loading || (isOllama ? !selectedModel : !cwd)}
              className="flex-1 py-2.5 bg-visor-accent hover:bg-indigo-600 disabled:opacity-30 text-white rounded-lg font-medium transition-colors text-sm"
            >
              {loading ? "Launching..." : "Launch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
