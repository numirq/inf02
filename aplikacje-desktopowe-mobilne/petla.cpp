#include<iostream>
using namespace std;

int main(){
    int a,b;
    cout << "podaj a: ";
    cin >> a;
    cout << "podaj b: ";
    cin >> b;

    while(a!=b)
    {
        if (a > b)
        {a = a-b;}
        else
        {b = b-a;}
    }
    cout << a;
}