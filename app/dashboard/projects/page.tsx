'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Grid3x3, List, Trash2 } from 'lucide-react'

interface Project {
  id: string
  project_number: string
  project_name: string
  project_address: string
  client_id: string
  contract_budget?: number
  description?: string
  status?: string
  external_project_manager?: string | null
  created_at?: string
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [formData, setFormData] = useState({
    project_number: '',
    project_name: '',
    project_street: '',
    project_city: '',
    project_state: '',
    project_zip: '',
    client_id: '',
    contract_budget: '',
    description: '',
    external_project_manager: '',
  })

  const [clients, setClients] = useState<any[]>([])

  const supabase = createClient()

  // Load projects and clients
  useEffect(() => {
    const loadData = async () => {
      try {
        const [projectsData, clientsData] = await Promise.all([
          supabase.from('projects').select('*'),
          supabase.from('clients').select('id, name'),
        ])
        console.log('Clients loaded:', clientsData.data)
        setProjects(projectsData.data || [])
        setClients(clientsData.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  // Filter and search projects
  useEffect(() => {
    let filtered = projects

    if (searchTerm) {
      filtered = filtered.filter((p) =>
        p.project_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredProjects(filtered)
  }, [projects, searchTerm])

  const getClientName = (clientId: string) =>
    clients.find((c) => c.id === clientId)?.name || '—'

  // Generate next project number (starts at 100)
  const generateNextProjectNumber = () => {
    const numbers = projects
      .map((proj) => parseInt(proj.project_number))
      .filter((n) => !isNaN(n))
    return (Math.max(...numbers, 99) + 1).toString()
  }

  // Handle open new project form
  const handleOpenNewProjectForm = () => {
    const nextNumber = generateNextProjectNumber()
    setFormData({
      project_number: nextNumber,
      project_name: '',
      project_street: '',
      project_city: '',
      project_state: '',
      project_zip: '',
      client_id: '',
      contract_budget: '',
      description: '',
      external_project_manager: '',
    })
    setShowNewProjectForm(true)
  }

  // Handle create project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.project_name || !formData.client_id || !formData.contract_budget || !formData.project_street || !formData.project_city || !formData.project_state || !formData.project_zip) {
      alert('Project name, street address, city, state, zip code, client, and contract budget are required')
      return
    }

    try {
      // Combine address fields into full address
      const fullAddress = `${formData.project_street}, ${formData.project_city}, ${formData.project_state} ${formData.project_zip}`

      console.log('Creating project:', formData)
      const { data, error } = await supabase
        .from('projects')
        .insert([
          {
            project_number: formData.project_number,
            project_name: formData.project_name,
            project_address: fullAddress,
            client_id: formData.client_id,
            contract_budget: parseFloat(formData.contract_budget),
            description: formData.description,
            external_project_manager: formData.external_project_manager || null,
          },
        ])
        .select()

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`Failed to create: ${error.message}`)
      }

      console.log('Project created successfully:', data)
      if (data) {
        setProjects([...projects, ...data])
        setFormData({ project_number: '', project_name: '', project_street: '', project_city: '', project_state: '', project_zip: '', client_id: '', contract_budget: '', description: '', external_project_manager: '' })
        setShowNewProjectForm(false)
        alert('Project created successfully!')
      }
    } catch (error) {
      console.error('Error creating project:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create project'}`)
    }
  }

  // Handle delete project
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`Failed to delete: ${error.message}`)
      }

      setProjects(projects.filter(p => p.id !== projectId))
      alert('Project deleted successfully!')
    } catch (error) {
      console.error('Error deleting project:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete project'}`)
    }
  }

  // Handle update status
  const handleUpdateStatus = async (projectId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId)

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`Failed to update: ${error.message}`)
      }

      setProjects(projects.map(p =>
        p.id === projectId ? { ...p, status: newStatus } : p
      ))
    } catch (error) {
      console.error('Error updating status:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to update status'}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-playfair font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Projects</h1>
          <p style={{ color: 'var(--color-muted)' }}>Manage and track all construction projects</p>
        </div>
        <button
          onClick={handleOpenNewProjectForm}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--color-navy)' }}
        >
          <Plus className="w-5 h-5" />
          New Project
        </button>
      </div>

      {/* New Project Form Modal */}
      {showNewProjectForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg p-8 max-w-md w-full" style={{ border: `1px solid var(--color-border)` }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-navy)' }}>Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Project Number (Auto-generated)
                </label>
                <input
                  type="text"
                  id="projects-project_number"
                  name="project_number"
                  value={formData.project_number}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition bg-gray-50"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
                />
                <p className="text-xs text-gray-500 mt-1">Project numbers are automatically generated</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Project Name
                </label>
                <input
                  type="text"
                  id="projects-project_name"
                  name="project_name"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="Enter project name"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'white',
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Street Address
                </label>
                <input
                  type="text"
                  id="projects-project_street"
                  name="project_street"
                  value={formData.project_street}
                  onChange={(e) => setFormData({ ...formData, project_street: e.target.value })}
                  placeholder="Enter street address"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'white',
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  City
                </label>
                <input
                  type="text"
                  id="projects-project_city"
                  name="project_city"
                  value={formData.project_city}
                  onChange={(e) => setFormData({ ...formData, project_city: e.target.value })}
                  placeholder="City"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'white',
                  }}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    State
                  </label>
                  <input
                    type="text"
                    id="projects-project_state"
                    name="project_state"
                    value={formData.project_state}
                    onChange={(e) => setFormData({ ...formData, project_state: e.target.value })}
                    placeholder="State"
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'white',
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Zip Code
                  </label>
                  <input
                    type="text"
                    id="projects-project_zip"
                    name="project_zip"
                    value={formData.project_zip}
                    onChange={(e) => setFormData({ ...formData, project_zip: e.target.value })}
                    placeholder="Zip code"
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'white',
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Client
                </label>
                <select
                  id="projects-client_id"
                  name="client_id"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'white',
                    color: 'var(--color-navy)',
                  }}
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Contract Budget
                </label>
                <input
                  type="number"
                  id="projects-contract_budget"
                  name="contract_budget"
                  step="0.01"
                  value={formData.contract_budget}
                  onChange={(e) => setFormData({ ...formData, contract_budget: e.target.value })}
                  placeholder="Enter contract budget"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'white',
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Description
                </label>
                <textarea
                  id="projects-description"
                  name="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter project description"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition resize-none"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'white',
                  }}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  External Project Manager <span className="font-normal text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  id="projects-external_project_manager"
                  name="external_project_manager"
                  value={formData.external_project_manager}
                  onChange={(e) => setFormData({ ...formData, external_project_manager: e.target.value })}
                  placeholder="Enter name"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'white',
                  }}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewProjectForm(false)}
                  className="flex-1 px-4 py-2 rounded-lg hover:opacity-80 transition"
                  style={{
                    border: `1px solid var(--color-border)`,
                    backgroundColor: 'white',
                    color: 'var(--color-navy)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
                  style={{ backgroundColor: 'var(--color-navy)' }}
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--color-muted)' }} />
          <input
            type="text"
            id="projects-search"
            name="search"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'white',
            }}
          />
        </div>


        <div className="flex gap-2 rounded-lg p-1" style={{ border: `1px solid var(--color-border)` }}>
          <button
            onClick={() => setViewMode('grid')}
            className="p-2 rounded transition"
            style={{
              backgroundColor: viewMode === 'grid' ? 'var(--color-linen-dark)' : 'transparent',
              color: 'var(--color-navy)',
            }}
          >
            <Grid3x3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className="p-2 rounded transition"
            style={{
              backgroundColor: viewMode === 'list' ? 'var(--color-linen-dark)' : 'transparent',
              color: 'var(--color-navy)',
            }}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Projects Display */}
      {loading ? (
        <div className="text-center py-12">
          <p style={{ color: 'var(--color-muted)' }}>Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <p style={{ color: 'var(--color-muted)' }}>No projects found. Create your first project to get started!</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="rounded-lg p-6 shadow-sm hover:shadow-md transition cursor-pointer"
              style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}
              onClick={() => router.push(`/dashboard/projects/${project.id}`)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>Project #{project.project_number}</p>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>{project.project_name}</h3>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteProject(project.id)
                  }}
                  className="p-2 hover:bg-red-50 rounded transition"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" style={{ color: 'var(--color-destructive)' }} />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-muted)' }}>Status:</span>
                  <select
                    id={`projects-status-${project.id}`}
                    name={`status-${project.id}`}
                    value={project.status || 'active'}
                    onChange={(e) => handleUpdateStatus(project.id, e.target.value)}
                    className="px-2 py-1 rounded border text-xs"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'white',
                      color: 'var(--color-navy)',
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-muted)' }}>Client:</span>
                  <span className="font-medium" style={{ color: 'var(--color-navy)' }}>{getClientName(project.client_id)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-muted)' }}>Budget:</span>
                  <span className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                    ${(project.contract_budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {project.external_project_manager && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-muted)' }}>Ext. PM:</span>
                    <span className="font-medium" style={{ color: 'var(--color-navy)' }}>{project.external_project_manager}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg overflow-x-auto" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <table className="w-full min-w-[640px]">
            <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: `1px solid var(--color-border)` }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Project #</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Project Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Client</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Ext. PM</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Budget</th>
                <th className="px-6 py-3 text-center text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr
                  key={project.id}
                  style={{ borderBottom: `1px solid var(--color-border)` }}
                  className="hover:opacity-75 cursor-pointer"
                  onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                >
                  <td className="px-6 py-4 text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>{project.project_number}</td>
                  <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{project.project_name}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-navy)' }}>{getClientName(project.client_id)}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{project.external_project_manager || '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    <select
                      id={`projects-list-status-${project.id}`}
                      name={`status-${project.id}`}
                      value={project.status || 'active'}
                      onChange={(e) => handleUpdateStatus(project.id, e.target.value)}
                      className="px-2 py-1 rounded border text-xs"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'white',
                        color: 'var(--color-navy)',
                      }}
                    >
                      <option value="active">Active</option>
                      <option value="on-hold">On Hold</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-navy)' }}>
                    ${(project.contract_budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteProject(project.id)
                      }}
                      className="p-2 hover:bg-red-50 rounded transition inline-flex"
                      title="Delete project"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: 'var(--color-destructive)' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
