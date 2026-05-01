Create a clean and scalable backend project using Node.js, Express, TypeScript and Prisma.

Requirements:

1. Project structure:
- src/
  - config/ (environment, prisma client)
  - modules/
    - usuario/
    - cliente/
    - recorrido/
    - parada/
    - tarifa/
    - viaje/
  - routes/
  - middlewares/
  - utils/
  - types/
  - app.ts
  - server.ts

2. Each module must contain:
- controller.ts
- service.ts
- routes.ts
- types.ts (if needed)

3. Use best practices:
- Separation of concerns (controller → service → data layer via Prisma)
- Controllers handle request/response only
- Services contain business logic
- Prisma client is centralized in config/prisma.ts

4. Configure:
- Express app with middlewares (json, cors)
- Global error handler middleware
- Basic logger middleware

5. Environment:
- Use dotenv
- Create .env.example with DATABASE_URL and PORT

6. Prisma:
- Assume Prisma is already initialized
- Import PrismaClient from a single instance (singleton pattern)

7. Routing:
- Create a central router (routes/index.ts)
- Mount module routes like:
  /usuarios
  /clientes
  /recorridos
  /paradas
  /tarifas
  /viajes

8. Types:
- Use TypeScript strictly
- Define basic Request typing where needed

9. Scripts:
- dev script using ts-node-dev
- build and start scripts

10. Keep it simple but production-ready:
- No authentication yet
- No complex validation libraries (keep it minimal)

Output:
- Folder structure
- Key files with boilerplate code
- Clean and readable code