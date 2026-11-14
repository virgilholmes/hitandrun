#include <QCoreApplication>
#include <QJSEngine>
#include <QJSValue>
#include <QFile>
#include <QDir>
#include <cstdio>
int main(int argc,char** argv) {
 QCoreApplication app(argc,argv); QJSEngine js;
 if(argc<2) return 2;
 const QString root=QDir(argv[1]).absolutePath();
 auto module=js.importModule(root+"/lib/scene.mjs");
 if(module.isError()) { std::fprintf(stderr,"%s\n",qPrintable(module.toString()+module.property("stack").toString()));return 1; }
 js.globalObject().setProperty("sceneModule",module);
 auto tests=js.importModule(root+"/tests/checks.mjs");
 auto check=tests.property("runChecks").call();
 if(check.isError()){std::fprintf(stderr,"JS checks: %s\n%s\n",qPrintable(check.toString()),qPrintable(check.property("stack").toString()));return 1;}
 std::printf("PASS: %d JavaScript parser checks\n",check.toInt());
 int total=0;
 for(int i=2;i<argc;i++) {
  QFile f(argv[i]); if(!f.open(QIODevice::ReadOnly))return 2;
  // ArrayBuffer via JavaScript's actual typed array implementation.
  const auto bytes=f.readAll();
  auto array=js.newArray(bytes.size());
  for(qsizetype j=0;j<bytes.size();j++)array.setProperty(j,quint8(bytes[j]));
  js.globalObject().setProperty("inputBytes",array);
  auto r=js.evaluate("sceneModule.readScene(new Uint8Array(inputBytes).buffer)");
  if(r.isError()){ std::fprintf(stderr,"%s: %s\n%s\n",argv[i],qPrintable(r.toString()),qPrintable(r.property("stack").toString()));return 1; }
  const int groups=r.property("groups").property("length").toInt();
  const int textures=r.property("textures").property("size").toInt();
  std::printf("PASS %s: %d primitive groups, %d PNG textures\n",argv[i],groups,textures);total+=groups;
 }
 std::printf("Total decoded primitive groups: %d\n",total);
 return 0;
}
