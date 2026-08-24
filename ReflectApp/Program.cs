using System;
using System.Linq;
using PKHeX.Core;
using System.Reflection;

class Program
{
    static void Main()
    {
        var methods = typeof(SaveFile).GetMethods().Where(m => m.Name.Contains("Party")).Select(m => m.ToString());
        foreach(var m in methods) Console.WriteLine(m);
    }
}
