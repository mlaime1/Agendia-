# Northflank Buildpack deployment

Northflank builds this service from GitHub with the Heroku Node.js Buildpack. The build generates Prisma Client, then removes development and optional packages before the runtime image is finalized. The generated client remains available to the API.

## Build and runtime sequence

1. The Buildpack installs the locked dependencies, including development dependencies (`npm ci --include=dev`).
2. It runs the `build` script: `prisma generate && tsc`.
3. It runs `heroku-postbuild`, which prunes development and optional dependencies.
4. The service starts with `npm start` (`node dist/server.js`).

`@prisma/client` stays in `dependencies` because the running API imports it. The Prisma CLI stays in `devDependencies`; it is needed for generation during the build, not for serving API requests.

## Database safety

The Buildpack prune hook does not run `prisma migrate deploy` and does not write to Supabase. It only removes packages after the generated client and application build are ready. Keep production database changes separate and explicitly authorized.

The Northflank logs identify the `heroku/nodejs` Cloud Native Buildpack. Its build-script order is documented in [Heroku's Node.js Cloud Native Buildpack guide](https://devcenter.heroku.com/articles/nodejs-cloud-native-buildpack-builds).
