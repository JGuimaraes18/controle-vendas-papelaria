#!/bin/sh

set -e

echo "Applying migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Creating superuser (if not exists)..."

if [ "$DJANGO_SUPERUSER_EMAIL" ] && [ "$DJANGO_SUPERUSER_PASSWORD" ]; then
    export DJANGO_SUPERUSER_USERNAME=${DJANGO_SUPERUSER_USERNAME:-admin}
    python manage.py createsuperuser --noinput || echo "Superuser already exists or failed to create."
else
    echo "Superuser env not set, skipping"
fi

echo "Creating demo accounts (if not exist)..."
python manage.py seed_demo || echo "Demo accounts already exist or failed to create."

echo "Running command: $@"
exec "$@"