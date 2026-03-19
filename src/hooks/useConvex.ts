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
  type?: string;
}

interface Generation {
  _id: string;
  projectId: string;
  prompt: string;
  code: string;
  model: string;
  createdAt: number;
  agentType?: string;
  language?: string;
}

interface Conversation {
  _id: string;
  projectId: string;
  title: string;
  agentType: string;
  createdAt: number;
  updatedAt: number;
}

interface Message {
  _id: string;
  conversationId: string;
  role: string;
  content: string;
  metadata?: string;
  createdAt: number;
}

interface Image {
  _id: string;
  projectId: string;
  prompt: string;
  imageUrl: string;
  model: string;
  style?: string;
  width: number;
  height: number;
  createdAt: number;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultModel: string;
  systemPrompt: string;
  supportedLanguages?: string[];
  supportedStyles?: string[];
}

// Hook for Convex integration using plain client
export const useConvex = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to create a new project with agent type
  const createProjectWithAgent = useCallback(async (name: string, agentType: string, userId?: string) => {
    try {
      const projectId = await (convex as any).mutation("agents:createProjectWithAgent", { name, agentType, userId });
      return projectId;
    } catch (err) {
      setError("Failed to create project");
      console.error(err);
      return null;
    }
  }, []);

  // Function to create a legacy project (for backward compatibility)
  const createProject = useCallback(async (name: string, userId?: string) => {
    return createProjectWithAgent(name, 'website', userId);
  }, [createProjectWithAgent]);

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

  // Function to load projects by agent type
  const loadProjectsByAgent = useCallback(async (agentType: string, userId?: string) => {
    try {
      const fetchedProjects = await (convex as any).query("agents:getProjectsByAgent", { agentType, userId });
      return fetchedProjects as Project[];
    } catch (err) {
      setError("Failed to load projects by agent");
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
    model: string,
    agentType?: string,
    language?: string
  ) => {
    try {
      const generationId = await (convex as any).mutation("generations:storeGeneration", {
        projectId,
        prompt,
        code,
        model,
        agentType,
        language,
      });
      return generationId;
    } catch (err) {
      setError("Failed to store generation");
      console.error(err);
      return null;
    }
  }, []);

  // Get available agents
  const getAvailableAgents = useCallback(async (): Promise<Agent[]> => {
    try {
      const agents = await (convex as any).query("agents:getAvailableAgents", {});
      return agents as Agent[];
    } catch (err) {
      console.error("Failed to get agents:", err);
      return [];
    }
  }, []);

  // Get agent by ID
  const getAgentById = useCallback(async (agentId: string): Promise<Agent | null> => {
    try {
      const agent = await (convex as any).query("agents:getAgentById", { agentId });
      return agent as Agent | null;
    } catch (err) {
      console.error(`Failed to get agent ${agentId}:`, err);
      return null;
    }
  }, []);

  // Create a new conversation
  const createConversation = useCallback(async (projectId: string, title: string, agentType: string) => {
    try {
      const conversationId = await (convex as any).mutation("conversations:createConversation", {
        projectId,
        title,
        agentType,
      });
      return conversationId;
    } catch (err) {
      setError("Failed to create conversation");
      console.error(err);
      return null;
    }
  }, []);

  // Get conversations for a project
  const getConversationsByProject = useCallback(async (projectId: string): Promise<Conversation[]> => {
    try {
      const conversations = await (convex as any).query("conversations:getConversationsByProject", { projectId });
      return conversations as Conversation[];
    } catch (err) {
      setError("Failed to get conversations");
      console.error(err);
      return [];
    }
  }, []);

  // Add a message to a conversation
  const addMessage = useCallback(async (
    conversationId: string,
    role: string,
    content: string,
    metadata?: string
  ) => {
    try {
      const messageId = await (convex as any).mutation("conversations:addMessage", {
        conversationId,
        role,
        content,
        metadata,
      });
      return messageId;
    } catch (err) {
      setError("Failed to add message");
      console.error(err);
      return null;
    }
  }, []);

  // Get messages for a conversation
  const getMessagesByConversation = useCallback(async (
    conversationId: string,
    limit?: number
  ): Promise<Message[]> => {
    try {
      const messages = await (convex as any).query("conversations:getMessagesByConversation", {
        conversationId,
        limit,
      });
      return messages as Message[];
    } catch (err) {
      setError("Failed to get messages");
      console.error(err);
      return [];
    }
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      await (convex as any).mutation("conversations:deleteConversation", { conversationId });
      return true;
    } catch (err) {
      setError("Failed to delete conversation");
      console.error(err);
      return false;
    }
  }, []);

  // Create an image record
  const createImage = useCallback(async (
    projectId: string,
    prompt: string,
    imageUrl: string,
    model: string,
    style?: string,
    width?: number,
    height?: number
  ) => {
    try {
      const imageId = await (convex as any).mutation("images:createImage", {
        projectId,
        prompt,
        imageUrl,
        model,
        style,
        width: width || 1024,
        height: height || 1024,
      });
      return imageId;
    } catch (err) {
      setError("Failed to create image record");
      console.error(err);
      return null;
    }
  }, []);

  // Get images for a project
  const getImagesByProject = useCallback(async (projectId: string): Promise<Image[]> => {
    try {
      const images = await (convex as any).query("images:getImagesByProject", { projectId });
      return images as Image[];
    } catch (err) {
      setError("Failed to get images");
      console.error(err);
      return [];
    }
  }, []);

  // Delete an image
  const deleteImage = useCallback(async (imageId: string) => {
    try {
      await (convex as any).mutation("images:deleteImage", { imageId });
      return true;
    } catch (err) {
      setError("Failed to delete image");
      console.error(err);
      return false;
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
    createProjectWithAgent,
    loadProjects,
    loadProjectsByAgent,
    deleteProject,
    storeGeneration,
    getAvailableAgents,
    getAgentById,
    createConversation,
    getConversationsByProject,
    addMessage,
    getMessagesByConversation,
    deleteConversation,
    createImage,
    getImagesByProject,
    deleteImage,
  };
};
