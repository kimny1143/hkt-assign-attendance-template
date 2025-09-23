#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'haas-simple-test',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'test_connection',
        description: 'Test if MCP server is working',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Test message',
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'test_connection') {
    return {
      content: [
        {
          type: 'text',
          text: `MCP Server is working! Your message: ${args?.message || 'No message provided'}`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HAAS Simple Test MCP Server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});