#include <QApplication>
#include <QSurfaceFormat>
#include "MainWindow.h"

int main(int argc, char *argv[]) {
    QSurfaceFormat format;
    format.setRenderableType(QSurfaceFormat::OpenGL);
    format.setVersion(3, 3);
    format.setProfile(QSurfaceFormat::CoreProfile);
    format.setDepthBufferSize(24);
    format.setStencilBufferSize(8);
    format.setSamples(4);
    QSurfaceFormat::setDefaultFormat(format);

    QApplication app(argc, argv);
    QApplication::setApplicationName("3DPL Studio");
    QApplication::setOrganizationName("3DPL");
    QApplication::setApplicationVersion("0.1.0");

    MainWindow window;
    window.resize(1500, 900);
    window.show();

    if (argc > 1) {
        window.openProjectFile(QString::fromLocal8Bit(argv[1]));
    }

    return app.exec();
}
