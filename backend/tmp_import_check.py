import importlib, sys
modules = ['app.schemas.trip', 'app.schemas.auth', 'app.schemas.booking']
for m in modules:
    importlib.import_module(m)
    print('Imported', m)
print('All imports successful')
