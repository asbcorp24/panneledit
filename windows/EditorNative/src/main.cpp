#include <QApplication>
#include <QCoreApplication>
#include <QSurfaceFormat>
#include "MainWindow.h"

int main(int argc, char** argv) {
    QSurfaceFormat format;
    format.setRenderableType(QSurfaceFormat::OpenGL);
    format.setProfile(QSurfaceFormat::CoreProfile);
    format.setVersion(3, 3);
    format.setDepthBufferSize(24);
    format.setStencilBufferSize(8);
    format.setSamples(4);
    QSurfaceFormat::setDefaultFormat(format);

    QApplication app(argc, argv);
    QCoreApplication::setOrganizationName("3DPL");
    QCoreApplication::setApplicationName("3DPL Editor");
    QApplication::setStyle("Fusion");

    MainWindow window;
    window.show();

    if (argc > 1)
        window.openProject(QString::fromLocal8Bit(argv[1]));

    return app.exec();
}
