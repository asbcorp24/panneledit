#include "MainWindow.h"

#include <QApplication>
#include <QCoreApplication>
#include <QSurfaceFormat>

int main(int argc, char* argv[]) {
    QCoreApplication::setOrganizationName("3DPL");
    QCoreApplication::setApplicationName("3DPL Editor");

    QSurfaceFormat format;
    format.setRenderableType(QSurfaceFormat::OpenGL);
    format.setProfile(QSurfaceFormat::CoreProfile);
    format.setVersion(3, 3);
    format.setDepthBufferSize(24);
    format.setStencilBufferSize(8);
    QSurfaceFormat::setDefaultFormat(format);

    QApplication app(argc, argv);
    app.setStyle("Fusion");

    MainWindow window;
    window.show();
    return app.exec();
}
