#!/usr/bin/env bash
# Database Setup Script
# This script creates the necessary databases and applies the schema and migrations

set -e  # Exit on error

echo "=========================================="
echo "Phone Party Database Setup"
echo "=========================================="
echo ""

# Check if PostgreSQL is running
if ! pg_isready > /dev/null 2>&1; then
    echo "ERROR: PostgreSQL is not running."
    echo "Please start PostgreSQL with: sudo service postgresql start"
    exit 1
fi

echo "PostgreSQL is running ✓"
echo ""

# Function to create database if it doesn't exist
create_database() {
    local db_name=$1
    echo "Checking database: $db_name"
    
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
        echo "  → Database '$db_name' already exists, skipping creation"
    else
        echo "  → Creating database '$db_name'..."
        sudo -u postgres createdb "$db_name"
        echo "  ✓ Database '$db_name' created"
    fi
}

# Function to apply schema to database
apply_schema() {
    local db_name=$1
    echo "  → Applying schema to '$db_name'..."
    # Apply schema and capture output
    local output
    if output=$(sudo -u postgres psql -d "$db_name" -f "$(dirname "$0")/schema.sql" 2>&1); then
        # Check for errors in the output
        if echo "$output" | grep -q "^ERROR"; then
            echo "$output" | grep "^ERROR"
            return 1
        fi
    else
        echo "  ✗ Failed to apply schema"
        return 1
    fi
    echo "  ✓ Schema applied to '$db_name'"
}

# Function to apply migrations to database
apply_migrations() {
    local db_name=$1
    local migrations_dir
    migrations_dir="$(dirname "$0")/migrations"
    
    echo "  → Applying migrations to '$db_name'..."
    for migration in "$migrations_dir"/*.sql; do
        if [ -f "$migration" ]; then
            echo "    → Applying: $(basename "$migration")"
            # Apply migration and capture output
            local output
            if output=$(sudo -u postgres psql -d "$db_name" -f "$migration" 2>&1); then
                # Check for errors in the output
                if echo "$output" | grep -q "^ERROR"; then
                    echo "$output" | grep "^ERROR"
                    return 1
                fi
            else
                echo "    ✗ Failed to apply migration"
                return 1
            fi
        fi
    done
    echo "  ✓ Migrations applied to '$db_name'"
}

# Create and setup databases
echo "Creating databases..."
echo ""

# Primary production database
create_database "phoneparty"
apply_schema "phoneparty"
apply_migrations "phoneparty"
echo ""

# Fallback database (used as default in database.js)
create_database "syncspeaker"
apply_schema "syncspeaker"
apply_migrations "syncspeaker"
echo ""

# Test database (used by CI/GitHub Actions)
create_database "phoneparty_test"
apply_schema "phoneparty_test"
apply_migrations "phoneparty_test"
echo ""

echo "=========================================="
echo "Database setup complete! ✓"
echo "=========================================="
echo ""
echo "Created databases:"
echo "  - phoneparty (primary production database)"
echo "  - syncspeaker (fallback database)"
echo "  - phoneparty_test (test database)"
echo ""
echo "To verify, run: sudo -u postgres psql -l"
echo ""
