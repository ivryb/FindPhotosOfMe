#!/bin/bash

# Script to manage the InsightFace models Docker volume
# This volume persists the face recognition models across container restarts

VOLUME_NAME="insightface-models"

show_help() {
    echo "Usage: ./manage-models-volume.sh [command]"
    echo ""
    echo "Commands:"
    echo "  info      Show volume information and size"
    echo "  clean     Remove the volume (models will be re-downloaded)"
    echo "  backup    Backup the volume to a tar file"
    echo "  restore   Restore the volume from a tar file"
    echo "  help      Show this help message"
    echo ""
}

show_info() {
    echo "======================================"
    echo "InsightFace Models Volume Info"
    echo "======================================"
    
    if [ -z "$(docker volume ls -q -f name=$VOLUME_NAME)" ]; then
        echo "Volume does not exist."
        echo "It will be created automatically when you run ./deploy-local.sh"
        return
    fi
    
    echo "Volume name: $VOLUME_NAME"
    echo ""
    
    # Get volume details
    docker volume inspect $VOLUME_NAME
    
    echo ""
    echo "Volume contents:"
    docker run --rm -v $VOLUME_NAME:/models alpine ls -lah /models
    
    echo ""
    echo "Volume size:"
    docker run --rm -v $VOLUME_NAME:/models alpine du -sh /models
    echo "======================================"
}

clean_volume() {
    echo "======================================"
    echo "Cleaning InsightFace Models Volume"
    echo "======================================"
    
    if [ -z "$(docker volume ls -q -f name=$VOLUME_NAME)" ]; then
        echo "Volume does not exist. Nothing to clean."
        return
    fi
    
    read -p "This will delete the volume and models will be re-downloaded. Continue? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing volume..."
        docker volume rm $VOLUME_NAME
        echo "✓ Volume removed successfully"
    else
        echo "Cancelled."
    fi
    echo "======================================"
}

backup_volume() {
    BACKUP_FILE="insightface-models-backup-$(date +%Y%m%d-%H%M%S).tar"
    
    echo "======================================"
    echo "Backing up InsightFace Models Volume"
    echo "======================================"
    
    if [ -z "$(docker volume ls -q -f name=$VOLUME_NAME)" ]; then
        echo "Volume does not exist. Nothing to backup."
        return
    fi
    
    echo "Creating backup: $BACKUP_FILE"
    docker run --rm -v $VOLUME_NAME:/models -v $(pwd):/backup alpine tar czf /backup/$BACKUP_FILE -C /models .
    
    echo "✓ Backup created: $BACKUP_FILE"
    echo "Size: $(du -h $BACKUP_FILE | cut -f1)"
    echo "======================================"
}

restore_volume() {
    echo "======================================"
    echo "Restoring InsightFace Models Volume"
    echo "======================================"
    
    # List available backups
    BACKUPS=($(ls insightface-models-backup-*.tar 2>/dev/null))
    
    if [ ${#BACKUPS[@]} -eq 0 ]; then
        echo "No backup files found."
        echo "Backup files should be named: insightface-models-backup-*.tar"
        return
    fi
    
    echo "Available backups:"
    for i in "${!BACKUPS[@]}"; do
        echo "  $((i+1)). ${BACKUPS[$i]} ($(du -h ${BACKUPS[$i]} | cut -f1))"
    done
    echo ""
    
    read -p "Select backup number to restore (1-${#BACKUPS[@]}): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[0-9]+$ ]] && [ $REPLY -ge 1 ] && [ $REPLY -le ${#BACKUPS[@]} ]; then
        BACKUP_FILE="${BACKUPS[$((REPLY-1))]}"
        
        # Create volume if it doesn't exist
        if [ -z "$(docker volume ls -q -f name=$VOLUME_NAME)" ]; then
            echo "Creating volume..."
            docker volume create $VOLUME_NAME
        fi
        
        echo "Restoring from: $BACKUP_FILE"
        docker run --rm -v $VOLUME_NAME:/models -v $(pwd):/backup alpine sh -c "cd /models && tar xzf /backup/$BACKUP_FILE"
        
        echo "✓ Volume restored successfully"
    else
        echo "Invalid selection."
    fi
    echo "======================================"
}

# Main script logic
case "${1:-help}" in
    info)
        show_info
        ;;
    clean)
        clean_volume
        ;;
    backup)
        backup_volume
        ;;
    restore)
        restore_volume
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
