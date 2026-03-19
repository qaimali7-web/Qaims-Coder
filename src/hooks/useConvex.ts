// src/hooks/useConvex.ts
import { useState, useEffect, useCallback } from 'react';
import convex from '../convexClient';

// Types for our Convex data
interface Project {
  _id: string;
  name: string;
  userId?: string;
  createdAt: number;
  updatedAt: number;
}

interface Generation {
  _id: string;
  projectId: string;
  prompt: string;
  code: string;
  model: string;
  createdAt: number;
}

// Hook for Convex integration using plain client
export const useConvex = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to create a new project
  const createProject = useCallback(async (name: string, userId?: string) => {
    try {
      // Use 'as any' to bypass strict TypeScript typing until API is generated
      const projectId = await (convex as any).mutation("projects:createProject", { name, userId });
      return projectId;
    } catch (err) {
      setError("Failed to create project");
      console.error(err);
      return null;
    }
  }, []);

  // Function to load projects for a user
  const loadProjects = useCallback(async (userId?: string) => {
    try {
      const fetchedProjects = await (convex as any).query("projects:getProjectsByUser", { userId });
      setProjects(fetchedProjects as Project[]);
      return fetchedProjects as Project[];
    } catch (err) {
      setError("Failed to load projects");
      console.error(err);
      return [];
    }
  }, []);

  // Function to delete a project
  const deleteProject = useCallback(async (projectId: string) => {
    try {
      await (convex as any).mutation("projects:deleteProject", { projectId });
      // Remove the deleted project from local state
      setProjects(prev => prev.filter(p => p._id !== projectId));
      return true;
    } catch (err) {
      setError("Failed to delete project");
      console.error(err);
      return false;
    }
  }, []);

  // Function to store a code generation
  const storeGeneration = useCallback(async (
    projectId: string,
    prompt: string,
    code: string,
    model: string
  ) => {
    try {
      const generationId = await (convex as any).mutation("generations:storeGeneration", {
        projectId,
        prompt,
        code,
        model
      });
      return generationId;
    } catch (err) {
      setError("Failed to store generation");
      console.error(err);
      return null;
    }
  }, []);

  // Load projects on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // For now, use a default userId. In a real app, you'd get this from auth
        const userId = "current-user";
        await loadProjects(userId);
      } catch (err) {
        console.error("Failed to load initial data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [loadProjects]);

  return {
    projects,
    loading,
    error,
    createProject,
    loadProjects,
    deleteProject,
    storeGeneration,
  };
};
