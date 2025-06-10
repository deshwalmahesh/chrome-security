#!/bin/bash

# Chrome Security Service Management Script

SERVICE_NAME="chrome-security"

case "$1" in
    start)
        echo "Starting Chrome Security service..."
        sudo systemctl start $SERVICE_NAME
        ;;
    stop)
        echo "Stopping Chrome Security service..."
        sudo systemctl stop $SERVICE_NAME
        ;;
    restart)
        echo "Restarting Chrome Security service..."
        sudo systemctl restart $SERVICE_NAME
        ;;
    status)
        echo "Chrome Security service status:"
        sudo systemctl status $SERVICE_NAME
        ;;
    logs)
        echo "Chrome Security service logs:"
        sudo journalctl -u $SERVICE_NAME -f
        ;;
    enable)
        echo "Enabling Chrome Security service to start at boot..."
        sudo systemctl enable $SERVICE_NAME
        ;;
    disable)
        echo "Disabling Chrome Security service from starting at boot..."
        sudo systemctl disable $SERVICE_NAME
        ;;
    test)
        echo "Testing Chrome Security service..."
        if curl -s http://127.0.0.1:27843/health > /dev/null 2>&1; then
            echo "✅ Service is responding"
            curl http://127.0.0.1:27843/health
        else
            echo "❌ Service is not responding"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|enable|disable|test}"
        echo ""
        echo "Commands:"
        echo "  start    - Start the service"
        echo "  stop     - Stop the service"
        echo "  restart  - Restart the service"
        echo "  status   - Show service status"
        echo "  logs     - Show service logs (real-time)"
        echo "  enable   - Enable service to start at boot"
        echo "  disable  - Disable service from starting at boot"
        echo "  test     - Test if service is responding"
        exit 1
        ;;
esac
