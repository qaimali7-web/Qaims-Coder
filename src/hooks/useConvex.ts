// src/hooks/useConvex.ts
import { useState, useEffect } from 'react';
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

// Hook for Convex integration
export const useConvex = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to create a new project
  const createProject = async (name: string, userId?: string) => {
    try {
      // This would call your Convex function
      // const projectId = await convex.mutation("projects:createProject", { name, userId });
      // For now, we'll simulate it
      console.log("Creating project:", name);
      return "simulated-project-id";
    } catch (err) {
      setError("Failed to create project");
      console.error(err);
      return null;
    }
  };

  // Function to store a code generation
  const storeGeneration = async (
    projectId: string,
    prompt: string,
    code: string,
    model: string
  ) => {
    try {
      // This would call your Convex function
      // const generationId = await convex.mutation("generations:storeGeneration", {
      //   projectId,
      //   prompt,
      //   code,
      //   model
      // });
      // For now, we'll simulate it
      console.log("Storing generation for project:", projectId);
      return "simulated-generation-id";
    } catch (err) {
      setError("Failed to store generation");
      console.error(err);
      return null;
    }
  };

  // Simulate loading data
  useEffect(() => {
    const loadData = async () => {
      try {
        // This would fetch from Convex
        // const fetchedProjects = await convex.query("projects:getProjectsByUser", { userId: "current-user" });
        // setProjects(fetchedProjects);
        // For now, we'll simulate it
        setProjects([
          {
            _id: "1",
            name: "My First Project",
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ]);
      } catch (err) {
        setError("Failed to load projects");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return {
    projects,
    loading,
    error,
    createProject,
    storeGeneration
  };
};