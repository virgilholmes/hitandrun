#include <QApplication>
#include <QWebEngineView>
#include <QWebEnginePage>
#include <QTimer>
#include <QFile>
#include <QUrl>
#include <QDebug>
#include <cstdio>
class Page : public QWebEnginePage {
public:
 using QWebEnginePage::QWebEnginePage;
 void javaScriptConsoleMessage(JavaScriptConsoleMessageLevel,const QString& msg,int line,const QString&) override {
  std::fprintf(stderr,"JS %d: %s\n",line,qPrintable(msg));
 }
};
int main(int argc,char** argv) {
 QApplication app(argc,argv);
 if(argc!=3)return 2;
 QWebEngineView view;
 auto page=new Page(&view);view.setPage(page);view.resize(1000,740);view.show();
 int result=1;
 const QString screenshot=argv[2];
 QObject::connect(page,&QWebEnginePage::titleChanged,&app,[&](const QString& title){
   if(title.startsWith("PASS:")) {
    std::printf("%s\n",qPrintable(title));
    QTimer::singleShot(1200,&app,[&]{if(view.grab().save(screenshot)){result=0;}app.quit();});
   }else if(title.startsWith("FAIL:")){std::fprintf(stderr,"%s\n",qPrintable(title));app.quit();}
 });
 QTimer::singleShot(30000,&app,[&]{std::fprintf(stderr,"Browser QA timed out\n");app.quit();});
 view.load(QUrl::fromLocalFile(QString::fromLocal8Bit(argv[1])));app.exec();return result;
}
