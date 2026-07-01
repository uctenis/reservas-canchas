Pasos para subir una copia privada de este sitio a GitHub y usarla como "staging" (solo tú)

Resumen: crear un repo privado en GitHub, subir el proyecto local, habilitar GitHub Pages desde la rama `staging` o `gh-pages`, probar cambios y cuando estés listo abrir un PR hacia el repositorio oficial o reemplazar la web en producción.

1) Crear el repositorio en GitHub
- Ve a https://github.com/new
- Nombre sugerido: `reservas-canchas-staging` (o `reservas-canchas-yourname`) 
- Selecciona **Private** para que solo tú (y colaboradores que invites) vean la copia.

2) Preparar tu copia local (Windows PowerShell o CMD)
- Abre terminal en la carpeta del proyecto (la que contiene `index.html`, `ranking.html`, etc.).

PowerShell (recomendado):
```powershell
# entra al folder del proyecto
cd "g:\Mi unidad\uctenis (personal)\pagina canchas uct\marzo 2026\reservas-canchas-main\reservas-canchas-main"
# inicializa git si aún no lo has hecho
git init
# añade todos los archivos
git add --all
git commit -m "Initial staging copy"
# crea rama staging
git branch -M staging
# añade el remoto (reemplaza USERNAME y repo name)
git remote add origin git@github.com:USERNAME/reservas-canchas-staging.git
# empuja la rama staging al remoto
git push -u origin staging
```

CMD (si usas clave HTTPS):
```cmd
cd /d "g:\Mi unidad\uctenis (personal)\pagina canchas uct\marzo 2026\reservas-canchas-main\reservas-canchas-main"
git init
git add .
git commit -m "Initial staging copy"
git branch -M staging
git remote add origin https://github.com/USERNAME/reservas-canchas-staging.git
git push -u origin staging
```

3) Habilitar GitHub Pages (vista previa)
- En GitHub, abre el repo -> Settings -> Pages
- En "Source" elige la rama `staging` (o `gh-pages`) y la carpeta `/ (root)` y guarda.
- GitHub te dará una URL tipo `https://USERNAME.github.io/reservas-canchas-staging/` (puede tardar unos minutos).

Nota sobre repositorios privados y Pages:
- GitHub Pages para repositorios privados requiere compatibilidad de cuenta (funciona en cuentas personales, organisation o con GitHub Pages habilitado). Si no puedes publicar desde un repo privado, puedes:
  - Crear el repo como público temporalmente mientras pruebas (no recomendado si debe ser privado).
  - Usar un servicio externo de preview (Netlify, Vercel) y desplegar tu rama `staging` con acceso protegido.

4) Trabajar con la copia
- Haz cambios localmente, luego:
```bash
# en tu rama staging
git add -A
git commit -m "Cambios: arreglo X"
git push
```
- La URL de Pages se actualizará si está habilitada.

5) Hacer oficial (promover cambios a producción)
Opción A: Usar Pull Request
- Crea un repo oficial (p. ej. `reservas-canchas`) o usa el repo actual en producción.
- Abre un PR desde `reservas-canchas-staging:staging` hacia `reservas-canchas:main` y revisa antes de mergear.
- Tras merge, el repositorio oficial contendrá los cambios; actualiza GitHub Pages o el hosting de producción.

Opción B: Reemplazar directamente la web en el repo de producción
- En el repo de producción: haz copia de seguridad, luego importa los archivos del staging o usa `git remote add staging ...` y `git fetch staging && git merge staging/staging`.

6) Seguridad y accesos
- Mantén el repo `private` para que solo tú lo veas.
- Para permitir que otras personas prueben, ve a Settings -> Manage access -> Invite collaborators.

7) Opcional: Automatizar despliegues con GitHub Actions
- Si quieres, puedo añadir un `workflow` que despliegue automáticamente a `gh-pages` cada push a `staging`.
- Dime si quieres que lo cree y si prefieres usar `gh-pages` (branch) o Pages desde la rama `staging`.

Problemas comunes
- Error al empujar por SSH: configura tu clave SSH en GitHub (https://docs.github.com/en/authentication/connecting-to-github-with-ssh). 
- Pages no aparece: espera 5–10 minutos; revisa Settings -> Pages si hay errores.

¿Quieres que cree:
- un `README.md` con estos pasos en tu proyecto (ya creado `GITHUB_DEPLOY_README.md`),
- un archivo `.github/workflows/deploy.yml` para desplegar automáticamente a `gh-pages`, o
- un commit local inicial y un script `push-to-github.ps1` listo para ejecutar (Windows)?

Dime cuál de las opciones quieres y lo preparo en el repo.

